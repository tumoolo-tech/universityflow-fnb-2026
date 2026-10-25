# PHASE-5 — A3 Accessibility (WCAG 2.2 AA)

**Project:** UniversityFlow · **Phase:** 5 · **Date:** 2026-10-17
**Commit:** 0554343 (branch `phase-5/stack`) · **Audit source:** tumoOLO_Audits @ 29eafd7 (A3 brief + `docs/audits/A3.project.md`)
**Result:** 0 Critical · 0 High · 6 Medium · 6 Low · 0 waived · 6 not measured

**Scope:** the UI Phase 5 added or changed (`git diff 7e8ddef..HEAD -- apps/`). Web: My offers and the letter
confirm form (`app/(app)/offers/*`, `components/offers.tsx`), My campus and First week (`app/(app)/campus/*`,
`app/(app)/first-week/*`, `components/campus.tsx`), My modules and the registration confirm form
(`app/(app)/modules/*`, `components/modules.tsx`), the four new chat cards and the crisis card's campus lines
(`components/artifacts.tsx`), and the nav. Native: `app/{offers,campus,first-week,modules}.tsx`,
`components/{offer-card,campus,my-modules-card,confirm-modules,university-chooser,artifact-card}.tsx`.
A3-10 (`recheck-title`, `crisis-title` fixed ids) is already open and is not re-reported.

## 1. Executive summary

**Verdict: does Phase 5 pass WCAG 2.2 AA? No, with 0 blocking failures.** Six Medium failures (2.4.3, 3.3.1,
4.1.3, 1.3.1) do not block the gate. axe is clean (WCAG A/AA) on every new web page at 320 CSS px with reduced
motion, including the letter and registration confirm forms and the chat with all four new cards. Every page
reflows at 320 px with no horizontal scroll, even with the 1.4.12 text-spacing override. Nothing new animates.
Every new colour pair measures at least 3.18:1 (non-text) and 6.04:1 (text). Native has improved since Phase 4: it
announces outcomes on iOS (`useAnnounce`), announces the switch to the confirm form, and labels each row's fields
and errors. **A3-01 has come back on the web.** Phase 4 fixed it on My goal, but the new pages repeat it: focus
drops to `<body>` after almost every action. **Measured in Playwright, 9 of 14 keyboard actions** on the new pages
left `document.activeElement` as `BODY`.

Top risks:
1. **My offers:** focus is lost after Accept, Decline and Remove. These are the most important actions in Stage 4 (A3-11).
2. **First week:** each tick disables the focused checkbox, which is the A3-01 pattern again (A3-12).
3. **Upload → confirm → save** on offers and modules: the whole view is swapped with focus on `<body>`, and the
   web never announces the new form (A3-13).
4. **Web registration confirm:** a bad module code isn't tied to its row among up to 40 rows (A3-14). The native form does this right.
5. **Native:** the section titles on the offer card, campus tour and first-week checklist aren't headings, so
   TalkBack and VoiceOver can't jump to "Health and safety" (A3-15). Changing the university is silent (A3-16).

## 2. Findings

| ID | Severity | Location | WCAG | Finding | Why it matters | Fix | Test (fails today) |
|---|---|---|---|---|---|---|---|
| A3-11 | Medium | `apps/web/app/(app)/offers/offers-view.tsx:231-267` (buttons), `:127,218` (`statusRef` never focused); `apps/web/components/offers.tsx:52,62` (`headingRef` plumbed, never passed) | 2.4.3, 4.1.3 | After a save, Accept is unmounted (`offer.status !== 'accepted'`), Decline is unmounted (`!== 'declined'`), and Remove unmounts the whole card. **Measured** (keyboard Enter, 320 px): `activeElement` is `BODY` after each of the three. The `headingRef`/`tabIndex={-1}` hook that #55 added to OfferCard for exactly this, and a `statusRef`, both exist but nothing uses them. | Accepting an offer is the main Stage 4 decision. A screen reader user (TalkBack on Android Chrome is the target set) loses their place and may restart from the top of a long page full of offer cards. The "Saved: you've accepted this offer" status is spoken, but they can't tell where they are. | After accept or decline, focus the offer's heading (`headingRef` per card, `tabIndex=-1`). After remove, focus the status line (`statusRef.current?.focus()` with `tabIndex=-1`) or the next card's heading. | Playwright: press Enter on "Accept this offer: …", then expect `document.activeElement` not to be `BODY` and to be inside that article. Do the same for Decline and Remove. |
| A3-12 | Medium | `apps/web/components/campus.tsx:258-263` (`disabled={busy}`), `apps/web/app/(app)/first-week/first-week-view.tsx:19,42` | 2.4.3 (A3-01 regression) | The checkbox that has focus is disabled while its tick saves. **Measured:** after Space on "Register", `activeElement` is `BODY`. The rest of the app uses `aria-disabled` plus an in-flight guard (A3-01, #55). This page doesn't. | Ticking through eight steps by keyboard or screen reader means finding your place again after every tick. This is the exact defect A3-01 closed. | Drop `disabled={busy}`. Use an `inFlight` ref like `offers-view.tsx:131`, and `aria-disabled` if a visual state is wanted. | Playwright: focus the first checkbox, press Space, wait for "Saved.", then expect `activeElement` to be that checkbox. |
| A3-13 | Medium | `apps/web/app/(app)/offers/offers-view.tsx:180-209, 322-336`; `apps/web/app/(app)/modules/modules-view.tsx:100-146, 186-207`; status lines `offers-view.tsx:218`, `modules-view.tsx:153` | 2.4.3, 4.1.3 | Each step of the hard-rule-6 flows replaces the whole view, with nothing focused and nothing announced. **Measured: `BODY`** after the letter is read (the file input that had focus is `disabled={busy}`, then unmounted), after Cancel on the letter form, after "Type my modules in", and after the modules confirm saves. After a confirm, the `role="status"` paragraph is mounted again *with* its text, the A3-04 pattern, so "Saved. Your check is below." may not be spoken. Native does announce `m.confirmTitle` here (`apps/native/app/modules.tsx:104,233`). | A blind learner uploads their letter and hears nothing. The page is now "Check your offer letter", but their screen reader is at the top of the document, or nowhere. After confirming, they aren't told the check is ready. These are the two confirm forms hard rule 6 depends on. | When a confirm form mounts, focus its `<h1>` (`tabIndex=-1`). When it unmounts, focus the page `<h1>` or the new card's heading. Keep one `role="status"` mounted across both views (lift it above the `if (letter)` / `if (draft)` branch). Don't disable the focused file input; guard it with `inFlight`. | Playwright: `setInputFiles` on the letter, then expect the focused element to be the "Check your offer letter" heading. Confirm, then expect focus on the offer heading and the status text to be present in a region that existed before the click. |
| A3-14 | Medium | `apps/web/app/(app)/modules/modules-view.tsx:285-288, 317, 373-383` | 3.3.1, 3.3.3 | A bad module code gives one form-level message, "Write the module code as printed…", that doesn't say *which* row is wrong. No field gets `aria-invalid` or an error id (the `Field` `error` prop is unused). Focus stays on the submit button. **Measured:** row 3 = `BAD$$CODE` gives one alert and `[aria-invalid=true]` count **0**. The native form marks the row (`apps/native/components/confirm-modules.tsx:217`). | A proof of registration read by OCR can have up to 40 rows. A learner (sighted or not) must check every code to find the bad one. Screen reader users get no per-field cue. | Validate per row. Pass `error={m.invalidCode}` to that row's `Field` (which gives `aria-invalid` + `aria-describedby`, `ui.tsx:41-73`). Name the row in the summary ("Module 3: …"). Move focus to the first invalid input. Do the same for "Choose your course". | Playwright: fill row 3 with `BAD$$CODE`, submit, then expect `getByLabel('Module 3: code')` to have `aria-invalid="true"` and to be focused. |
| A3-15 | Medium | `apps/native/components/offer-card.tsx:90-92, 119-121, 131-133`; `apps/native/components/campus.tsx:74-76, 113-115, 118-120, 179-181, 245-248` | 1.3.1, 2.4.6 | Native section titles are `Body strong` with no `accessibilityRole="header"`: "Conditions, as your letter puts them", "With your final matric results", "Your Plan B", the campus need groups ("Health and safety", "Studying"…), place names, "Dates to know", the safety tip titles, and "Your faculty office". The web uses `h3`/`h4` for all of these. `my-modules-card.tsx:68-74` already has a `SectionTitle` with the header role. | The Wits campus tour has 16 places with about 6 elements each. A TalkBack or VoiceOver user can't move by heading to "Health and safety" (clinic, counselling, security) and has to swipe through about 100 elements. On the offer card they can't jump to the final-results check or to Plan B. Linear swiping still works, so this is Medium. | Move `SectionTitle` into `ui.tsx` (role `header`) and use it for each title listed. Keep place names as `Body strong`, or make them headers at a lower level. | jest (RNTL): render `CampusTourView` with a fixture, then `getAllByRole('header')` includes "Health and safety". Render `OfferCardView` with `checksFinal`, then expect a "With your final matric results" header. |
| A3-16 | Medium | `apps/native/components/university-chooser.tsx:25-34`; `apps/native/app/campus.tsx:19,34-37,59-65`; `apps/native/app/first-week.tsx:19,36-38,81-88` | 4.1.3, 2.4.3 | Pressing "Look around Wits" reloads the tour or checklist *above* the chooser in place. The pressed button is then filtered out (`o.id !== current`) and unmounts. Nothing is announced: no loading text (because `data` is still set) and no "now showing Wits". | The VoiceOver or TalkBack user's focus vanishes, and the content that changed is off-screen above them. They don't know whether the press did anything. (The web uses links to a new URL, which Next's route announcer covers.) | After the load resolves, `announce(t.exploring(name))`, or move accessibility focus to the tour's heading (`AccessibilityInfo.setAccessibilityFocus` with a ref). Show `en.common.loading` while it loads. | jest: spy on `AccessibilityInfo.announceForAccessibility`, press "Look around Wits", resolve the mocked API, then expect a call containing "Wits". |
| A3-17 | Low | `apps/web/app/(app)/offers/offers-view.tsx:448-453`; `apps/web/app/(app)/modules/modules-view.tsx:428-433` | 2.4.3 | "Remove condition n" and "Remove module n" unmount the button that has focus. **Measured: `BODY`** after both. ("Add a condition" keeps focus.) | Removing several wrongly read rows by keyboard means finding your place again each time. | Focus the next row's first field (or the previous row's remove button, or "Add a …" when the list is empty). | Playwright: Enter on "Remove module 3", then expect `activeElement` not to be `BODY`. |
| A3-18 | Low | `apps/web/app/(app)/offers/offers-view.tsx:211, 284, 312, 373, 381, 472`; `apps/native/app/offers.tsx:264-270` | 3.3.1 | "Save this offer" and "This is correct: save my offer" do nothing when the course or kind is missing. The web uses `aria-disabled` and returns silently. Native uses `disabled` with no hint. **Measured:** Enter on an empty form gives no alert, no status, and focus stays put. | A learner who missed the course select (a long list on a phone) presses Save and nothing happens. Screen readers say "dimmed" but not why. | On submit with missing fields, show `Field` errors ("Choose the course", "Choose what kind of offer it is") and focus the first one. On native, add a `hint` to the disabled button naming what's missing. | Playwright: press Save on an empty form, then expect an alert naming the course field. |
| A3-19 | Low | `apps/web/components/campus.tsx:119-120` (and `SourceLink` in `components/ui.tsx:162-168`) | 2.4.4 (passes in context), 2.4.9 | **Measured on `/campus?university=wits`:** "Open in maps (opens in a new tab)" ×16 and "Official source (opens in a new tab)" ×16, with no place name. Each sits in an `li` with the place name, so 2.4.4 passes, but a links list (NVDA Insert+F7, the TalkBack links menu) shows 32 identical entries. Native already adds the place (`apps/native/components/campus.tsx:129,132`). This is the same class as A3-06. | A learner looking for the clinic's map from the links list can't tell the entries apart. | Add `<span className="sr-only">: {p.name}</span>` to both, as `programme-card.tsx` does. | Playwright: `getByRole('link', { name: /Open in maps.*Campus Health/ })` resolves. |
| A3-20 | Low | `apps/web/components/campus.tsx:257-260` (first-week checkbox); `campus.tsx:117-121` (SourceLink in the 44 px row) | 1.4.11 / 2.5.8 (both pass) | At 320 px the `size-6` checkbox in the flex label shrinks: **measured 13–22 px wide** by 24 high (no `shrink-0`). The label is the real target (min-h-11, full width), so 2.5.8 passes. "Official source" in the place rows is **123×23 px** next to 44 px "Call" and "Open in maps" targets. It passes 2.5.8 only through the spacing exception. | The tick box looks smaller and squashed exactly where learners tap it most (budget phones, outdoors). The small source link breaks the project's own 44 px rule (`tokens.target`). | Add `shrink-0` to the checkbox. Give `SourceLink` `inline-flex min-h-11 items-center` when it isn't inside running text (a `block` prop). | Playwright at 320 px: the checkbox `getBoundingClientRect().width` is 24. |
| A3-21 | Low | `apps/web/components/campus.tsx:275` (`text-muted` "Done on…" inside `bg-sunk`); `apps/native/components/campus.tsx:221-228` + `components/ui.tsx:466-471` (Checkbox `pair="sunk"`: `lineStrong` box on `surfaceSunk`) | 1.4.3 / 1.4.11 (guard gap) | **Measured: inkMuted/surfaceSunk 7.28:1, lineStrong/surfaceSunk 3.18:1.** Both pass, but neither pair is in `TEXT_PAIRS` / `NON_TEXT_PAIRS` (`packages/tokens/src/index.ts:97-131`), and 3.18 is close to the 3:1 floor. The `ui.tsx:312` comment says the checkbox holds 3:1 "on a card", but it is now used on sunk. | A small change to `lineStrong` or `surfaceSunk` would take the unticked box below 3:1 with no test failing. This is the same class as A3-08. | Add `['inkMuted','surfaceSunk']` to TEXT_PAIRS and `['lineStrong','surfaceSunk']` to NON_TEXT_PAIRS. | The token test then covers both pairs. Today `expect(NON_TEXT_PAIRS).toContainEqual(['lineStrong','surfaceSunk'])` fails. |
| A3-22 | Low | `apps/web/e2e/journey.spec.ts:29-41, 517-640` | (process) | E2E axe never visits `/campus`, `/first-week` or the letter confirm form, and `SIGNED_IN_PAGES` (the turn-away check) leaves out `/campus` and `/first-week`. The overlay says axe runs on every key page. For Phase 5 that is true only of `/offers` and `/modules`. | A regression on the campus tour (safety contacts) or the checklist wouldn't be caught by CI. | Add a 5b journey: accept an offer, open `/campus` and `/first-week`, tick a step, run `expectAccessible`. Add both paths to `SIGNED_IN_PAGES`. Upload a letter in the offers journey and run axe on the confirm form. | (the new journey is the test) |

## 3. Regression check

- **A3-01 (focus after a save):** **back on the new pages.** It stays fixed on `/goals`, but My offers (A3-11), First
  week (A3-12), the two confirm flows (A3-13) and row removal (A3-17) drop focus to `<body>`. The structural fix
  that Phase 4's roadmap proposed (assert focus after each action in the shared E2E helper) was not built. That
  is why the defect returned.
- **A3-02 (iOS announcements):** confirmed fixed and followed. `useAnnounce(status)` is used on the offers,
  first-week and modules screens. `Notice` announces danger and warning. The switch to the confirm form is announced (`modules.tsx:104,233`).
- **A3-03 (row-aware labels):** followed. "Module n: code/name/semester/credits" on web and native, and native
  errors go in the hint. The web has no per-row error (A3-14).
- **A3-04 (persistent status):** followed on each page, but each confirm view swap re-mounts it (A3-13).
- **A3-05 / A3-10 (fixed ids):** all four new cards and `CrisisCampus` use `useId()`. **Measured:** the chat with
  the offer card twice, the campus tour, the first week and My modules twice has **0 duplicate ids**. axe best practice
  `landmark-unique` flags the repeated "Who to see" sections when the same My modules card appears twice. That is
  inherent to repeating a card, not a WCAG failure. A3-10 (`recheck-title`, `crisis-title`) is still open.
- **A3-06 (repeated button labels):** followed for the offer buttons ("Accept this offer: <course>") and native
  links. The web campus links don't follow it (A3-19).
- **A3-07 (radiogroup, expanded):** followed on native (kind radios, year radios, term picker with `expanded`).
- **KI-01 (white on orange):** fixed. The days-left badges are `onAccent` on `accent`, 9.15:1.
- **KI-04 (reduced motion):** confirmed. Phase 5 adds no animation, web or native (diff searched for
  `animate|transition|Animated|LayoutAnimation|motion`: only the "Nothing animates." comments). axe ran with
  `reducedMotion: 'reduce'`, and every view was final and visible.
- **KI-02, KI-03, KI-07, KI-09:** N/A. There is no accordion, thumbnail, image or count-up. Day counts are static badges.

## 4. Measurements

**Probe (throwaway, `a3-probe.mjs` in the session scratchpad, deleted afterwards):** `next start` on **port 3103**
against the existing production build. It used the E2E environment (`UF_LOCAL_PRODUCTION_BUILD=1`,
`UF_CATALOGUE_PREVIEW=1`, `UF_CATALOGUE_E2E_FIXTURES=1`, `UF_PROVIDERS=local`, `pglite:memory`) and signed in
through `/dev/outbox`. Chromium ran at 320×640 with `reducedMotion: 'reduce'` and touch. The server was stopped
afterwards and the port confirmed free. No server errors were logged. The probe never ran the E2E suite or any package suite.

- **axe (WCAG 2.0/2.1/2.2 A/AA + best practice)** on `/offers` (empty and with two offers), the letter confirm form,
  `/campus` (accepted UP; `?university=wits`; `?university=uct`), `/first-week` (UP; `?university=wits`), `/modules`
  (empty, confirm form with an error, with a check), and `/chat` with all four Phase 5 cards: **no WCAG
  violations.** Best practice found only `region` on the preview-only draft banner (as in Phase 4, never in
  production) and `landmark-unique` in the chat (see §3).
- **Reflow at 320 CSS px:** `scrollWidth == clientWidth == 320` on every page above, with and without the 1.4.12
  override. The 12-link nav scrolls inside its own container (its items extend past 320 px within it, but the page does not scroll).
- **Focus after keyboard actions:** `BODY` after Accept, Decline, Remove (offers), the letter read, Remove condition
  1, letter Cancel, the first-week tick, "Type my modules in", Remove module 3, and the modules confirm saving. The
  focused element was kept after Save offer, Add a condition, an empty Save, a letter confirm with no course, and a modules confirm with an invalid code.
- **Titles and headings:** "My offers · UniversityFlow", "My campus · UniversityFlow", "First week · UniversityFlow",
  "My modules · UniversityFlow". One `<h1>` on each.
- **Crisis card campus lines:** none rendered live (0 `crisis-campus`). They show verified records only, and the
  catalogue has none yet. Reviewed from code: `CrisisCampus` is a labelled `section` with an `h3`, and each line has a
  `tel:` "Call <number>: <name>" link (label starts with the visible text, 2.5.3). Native `CrisisCampusView` has a
  header role and a `CallButton` with role `link`, a 44 pt minimum and the name in its label.

**Contrast** (WCAG formula on `packages/tokens` values; every Phase 5 surface is opaque):

| Pair | Ratio | Where |
|---|---|---|
| inkMuted / surfaceSunk | 7.28 | web "Done on…" in step boxes (A3-21, untested pair) |
| lineStrong / surfaceSunk | 3.18 (non-text) | native unticked checkbox in step boxes (A3-21, untested pair) |
| browser checkbox #767676 / surfaceSunk | 3.78 (non-text) | web first-week checkbox |
| brand / surfaceSunk | 6.50 | "Open in maps", source links, native `sunkBrand` |
| onBrand / brand | 7.81 | "Call <number>" buttons, upload labels |
| focus / surfaceSunk | 5.58 (non-text) | focus ring inside place and step boxes |
| onAccent / accent | 9.15 | days-left badges (offers, modules) |
| warning / warningSoft · ink / warningSoft | 6.37 · 15.06 | draft badges, "things to fix" items |
| success / successSoft | 6.04 | "Final offer", "Registered", "Done" badges |
| ink / surface | 17.17 | native `Badge tone="card"` on sunk place boxes |

**Native (from code; no device):** every new control is the shared `Button` (role, label, `disabled`/`busy`, 44×44
minimum), `Radio`/`RadioGroup`, `Checkbox` (44 minimum), or a `Pressable` link with role `link` and `minHeight:
theme.target`. Every repeated action carries its context in the label ("Accept this offer: <course>", "Open in maps:
<place>", "Call <n>: <place>"). There is no `numberOfLines`, fixed height or `maxFontSizeMultiplier` in the new
files, so text can scale. The message is `selectable` and shared with the share sheet.

## 5. Not measured

1. **Screen-reader read-through** (NVDA, VoiceOver, TalkBack): there is no screen reader or device here. A3-15 and A3-16
   come from code and documented RN behaviour, not a device run.
2. **Native on device:** touch targets checked from styles. Dynamic Type at 200% and focus behaviour when a pressed
   `Pressable` unmounts were not observed.
3. **Real browser zoom** at 200% and 400%: approximated by a 320 CSS px viewport.
4. **Crisis campus lines live:** no verified clinic, counselling or security record exists, so the section never renders.
5. **Native jest suites:** not run (parallel-audit rule, gotcha 39). No native probe was written.
6. **OS-owned UI:** camera, photo and document pickers, the share sheet, the dialler and the maps app.

## 6. Waived

None.

## 7. Remediation roadmap

- **Quick wins (< 1 day):** A3-12 (drop `disabled`), A3-19 (sr-only place name), A3-20 (`shrink-0`, SourceLink
  `min-h-11`), A3-21 (two token pairs), A3-17 (focus the next row).
- **Medium:** A3-11 + A3-13 (one focus helper: focus a heading or status after a save or view swap; one status
  region across views), A3-14 (per-row errors on web, matching native), A3-15 (shared `SectionTitle`), A3-16
  (announce the change), A3-18 (submit-time field errors), A3-22 (the 5b E2E journey).
- **Structural (overdue since Phase 4):** a shared E2E helper `pressAndExpectFocus(page, locator)` that fails when
  `activeElement` is `BODY` after an action. Use it in every journey. Without it, each new page reintroduces A3-01.

## 8. What's genuinely good

- **Native caught up on announcements.** `useAnnounce(status)` on every new screen, `announce(m.confirmTitle)` when
  the confirm form opens, and `Notice` announces errors on iOS. This is better than the web's view swap.
- **Native confirm-modules** marks the bad row itself (`error` in that row's `Field`, read in the hint). The web
  should copy this.
- **Context in every repeated name:** "Accept this offer: <course>", "Remove: <course>", native "Open in maps:
  <place>", "Call <number>: <place>", and `SourceLink context`.
- **Text first, no map tiles:** the campus tour is lists, headings and `tel:`/maps links, with no images or embeds.
  The safety contacts are real, dialable links and never in an image.
- **All four new cards use `useId()`** (A3-05 learned). The chat with repeated cards has 0 duplicate ids.
- **Offer conditions** are a `ul` of `blockquote`s (the university's words, marked as quotes). The status is a word,
  not a colour. Kinds are written out ("Provisional offer"), never shown by tone alone.
- **The first-week checklist** is an `ol` with real checkboxes inside labels (44 px rows) and a persistent `sr-only`
  `role="status"`.
- **Nothing animates** anywhere in Phase 5. Every view is final under reduced motion.
