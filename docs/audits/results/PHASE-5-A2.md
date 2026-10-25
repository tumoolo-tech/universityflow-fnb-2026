# PHASE-5 — A2 Design fidelity

**Project:** UniversityFlow · **Phase:** 5 · **Date:** 2026-10-17
**Commit:** 0554343 (branch `phase-5/stack`) · **Audit source:** tumoOLO_Audits A2 (brief `audit-brief-A2.md`, Phase 4 text) with the Phase 5 common rules
**Result:** 0 Critical · 0 High · 1 Medium · 8 Low · 0 waived · 4 not measured

**Scope:** the screens and artifacts Phase 5 added (`git diff 7e8ddef..HEAD -- apps/ packages/ui packages/tokens`).
Web: My offers (`app/(app)/offers/*`, `components/offers.tsx`), My campus (`app/(app)/campus/*`), First week
(`app/(app)/first-week/*`), the campus tour, safety guidance and crisis-card campus lines (`components/campus.tsx`),
My modules (`app/(app)/modules/*`, `components/modules.tsx`), the chat's artifact panel (`components/artifacts.tsx`)
and the nav. Native: `app/{offers,campus,first-week,modules,index}.tsx`, `components/{offer-card,campus,
my-modules-card,confirm-modules,university-chooser,artifact-card}.tsx`. `packages/tokens` did not change in Phase 5.
Code review only; nothing was rendered.

**Design reference used.** Still no design document (A2-11, open, the owner's). As in Phase 4, the reference is
`packages/tokens/src/index.ts` (with `TEXT_PAIRS`/`NON_TEXT_PAIRS`), both themes derived from it
(`apps/native/lib/theme.ts`, `apps/web/app/globals.css`), and the existing primitives (`apps/web/components/ui.tsx`,
`apps/native/components/ui.tsx`). The shared checklist's landing-page checks (12 sections, bokeh, zero radius, `.42em`
tracking, kerf logo) don't apply to this product and were skipped, not counted.

**Known and not re-reported:** A2-01 (web spacing is Tailwind's scale; Phase 5 adds more `gap-5`/`p-5` steps that
are 20px on the web and 24px in tokens), A2-02 (primitives differ between platforms; Phase 5 adds new instances, e.g.
the native `quiet` Button paints the `canvas` colour as a block inside the first-week's sunk step panels,
`apps/native/components/campus.tsx:265-271`, because `BUTTON_PAIR.quiet` is `pageBrand`), A2-11 (no design document).

---

## 1. Executive summary

**Fidelity verdict: minor drift.** Phase 5 is clean where it matters most: no raw colour or size anywhere in the new
app code (`pnpm check` passes; a grep of the diff for hex, `rgb(`, numeric style literals and animation finds only a
test fixture), every native colour goes through `theme.on(pair)`, every new control meets the 44px target, nothing
animates, and every new artifact shows its draft badge and official source on both platforms, with one exception
(A2-14). The drift is in **how the app is navigated** and in **small treatments that differ per platform with no
recorded reason**. Phase 5 took the web nav from 7 to 11 links, which no longer fits even a 1024px screen, and the
native home screen to 11 equal-weight buttons.

Top risks:
1. **A2-12:** the web nav is now about 1,100px of links in a sideways-scrolling strip with no visible cue. At 360px
   only Chat, My results and Applications show; the four Phase 5 pages are all off screen.
2. **A2-13:** the new `surface` badge tone is used on white cards, so "Elective", "Registered for 2027" and the
   offer's source render as loose text (1.00:1 chip boundary). This is A2-07 in reverse.
3. **A2-14:** the native offer card leaves out the Draft badge on Plan B courses that the web shows.
4. **A2-15:** on native, "First week" from My campus drops the university being looked at.
5. **A2-16:** offer conditions, module differences, a passed deadline and the chat cards' way to their pages each
   look or behave differently on web and app, undocumented.

## 2. Findings

| ID | Severity | Location | Finding | Why it matters | Fix | Test (fails today) |
|---|---|---|---|---|---|---|
| A2-12 | Medium | `apps/web/app/(app)/nav.tsx:9-21,26,36`; `apps/native/app/index.tsx:59-90` | **Navigation no longer scales.** Phase 5 adds My offers, My campus, First week and My modules to a flat, single-row nav (`overflow-x-auto`, `whitespace-nowrap`, `px-3`, `gap-1`). At the 17px base, the 11 labels come to an estimated ~1,100px (7 links were ~680px). That overflows a 360px phone (about 3 links visible), a 768px tablet and a 1024px laptop. There is no fade, arrow or "more" cue that the strip scrolls, and the four new Stage 4 pages are always beyond the first screen. Native home is now 11 stacked `secondary` buttons of equal weight under one primary (Chat), mixing Grade 11 (Results, My goal) and first-year (First week, My modules) destinations. | A Grade 12 learner who has just got an offer can't see that My offers exists, and the menu offers Stage 4 pages to a Grade 11 learner. The launch standard requires the menu to work at 360px, which includes being able to find things in it. The page doesn't scroll sideways, so this is discoverability, not overflow. | Group the nav by stage: show the 4 or 5 links for the learner's current stage (the server knows it), with the rest under a "More" disclosure. At minimum, add an overflow cue (an edge fade in `--uf-color-surface`) and scroll the current link into view. Do the same on native home: one section per stage, current stage first. Record the decision in the design document (A2-11). | A Playwright test at 360px asserts every nav link is visible or reachable through a visible "More" control (`/offers` is off screen today). A native test asserts home renders the current stage's destinations first. |
| A2-13 | Low | `apps/web/components/offers.tsx:68`; `apps/web/components/modules.tsx:217,253`; native counterparts `apps/native/components/offer-card.tsx:58`, `my-modules-card.tsx:219,253` | `Badge tone="surface"` (added for sunk panels by A2-07) is used directly on a white `Card`, so `bg-surface` sits on `bg-surface` with no border: the source, "Compulsory/Elective" and "Registered for 2027" chips vanish into the card (1.00:1). Native uses the default `sunk` tone in the same places, so the chips show in the app and not on the web. | The chip row is how the offer and module cards tell kinds apart at a glance. Two of the four chips on the web look like loose text beside coloured ones. This is the defect A2-07 fixed, reintroduced the other way round. | Use the default `neutral` (sunk) tone on cards and keep `surface` for sunk panels only. Better still, have `Badge` take the background it sits on (as native `pair` does) so the right tone can't be missed. | A web component test renders `OfferCard` and `MyModulesCard` and asserts no badge has the same background class as its card (`bg-surface` today). |
| A2-14 | Low | `apps/native/components/offer-card.tsx:141-145`; web `apps/web/components/offers.tsx:139-149`; type `packages/ui/src/artifacts.ts:248-254` | The native offer card's Plan B list renders `universityName: name (qualification)` and ignores `p.draft`. The web shows `<Badge tone="warning">Draft</Badge>` beside each draft course. Every other Phase 5 draft badge is present on both platforms. **Reachability:** drafts reach the artifact only in preview mode (`catalogueDrafts`), never for a live learner, so this is Low, not higher. | In preview, the owner and verifiers use the app to review drafts. An unverified course shown unlabelled as a Plan B looks verified, which is what hard rule 3's label exists to prevent. | Render `<Badge tone="warning">{en.common.draftBadge}</Badge>` after each draft Plan B row, as the web does. | In `apps/native/__tests__/offers.test.tsx`, a not-met final check with a `draft: true` Plan B course expects the text `en.common.draftBadge` (absent today). |
| A2-15 | Low | `apps/native/app/campus.tsx:52-58`; web `apps/web/components/campus.tsx:139-145`; server `apps/web/lib/server/campus.ts:72-93` | Native My campus's "First week" button does `router.push('/first-week')` without the university the learner chose to look around. The web links to `/first-week?university=<id>`. `firstWeekResponse` then falls back to the accepted offer's university, or to no checklist and the chooser. | A learner exploring UJ who taps First week gets Wits' checklist (if they accepted Wits) or an empty chooser. The same journey behaves differently on web and app. | Push `{ pathname: '/first-week', params: { university: data.tour.universityId } }` and have `first-week.tsx` seed `chosen` from `useLocalSearchParams()`. | A native campus test with a chosen (non-accepted) university presses the button and expects the push to carry `university` (it doesn't today). |
| A2-16 | Low | Conditions: web `apps/web/components/offers.tsx:105-113` vs native `apps/native/components/offer-card.tsx:102-113`. Differences: web `apps/web/components/modules.tsx:270` (4px rule) vs native `my-modules-card.tsx:276-285,336-341` (2px). Passed deadline: web `modules.tsx:163` (Badge) vs native `my-modules-card.tsx:162` (Notice). Chat cards: web `apps/web/components/artifacts.tsx` (`linkToPage` on all four) vs native `apps/native/components/artifact-card.tsx:129,136,143` (none on offer, campus tour, first week). Links: web `offers.tsx:92,123` vs native `offer-card.tsx:84-88,122-123` | The same Phase 5 artifacts differ per platform in five ways. (1) Offer conditions, "the university's words, shown as quoted", are a `<blockquote>` with a `lineStrong` left rule on the web and a plain sunk box on native, so the "quoted" signal is web-only. (2) The module-difference rule is 4px on the web and 2px (`border.thick`) on native, and neither uses `border.rule`. (3) A passed change deadline is a badge on the web and a full `Notice` on native, which also announces "deadline passed" every time the card mounts (`Notice` announces warnings). (4) In chat, the web offer, campus and first-week cards link to their pages; native gives only My modules a way there. (5) Native offer cards drop the "confirm final results" and "About me" links the web gives. The native letter upload that planning.md §11 5d lists is also absent (`apps/native/app/offers.tsx:27` says "Phase 5d"), and status.md doesn't record it as deferred. | None of these is recorded as a decision (A2-11), so each counts as drift. (3) is also a repeated screen-reader interruption (an A3 overlap). (4) leaves a native learner with a card in chat and no way to act on it. | Pick one treatment for each and apply it to both platforms: a quoted-condition style with `border.rule` on both, `border.rule` for differences, a badge for a passed deadline, and `linkToPage` (a quiet button to the screen) on every native Phase 5 chat card. Record the native letter-upload deferral in status.md. | Native artifact-card tests expect a button to `/offers`, `/campus` and `/first-week` (absent). A my-modules test with a passed deadline expects no `notice-warning` (present). |
| A2-17 | Low | `apps/web/components/offers.tsx:108` (`border-l-4`), `apps/web/components/modules.tsx:270` (`border-l-4`), `apps/web/app/(app)/campus/university-chooser.tsx:32` (`border-2`); pre-existing `apps/web/components/ui.tsx:31,77,148`, `nav.tsx:36` | Since #64 (A2-05), `globals.css:37-40` maps `border-thin`, `border-thick` and `border-l-rule` to the tokens. Phase 5's new web code still uses Tailwind's built-in `border-l-4` and `border-2`, as do the primitives. The values match today, but they don't follow the tokens. The guard checks sizes in native styles only. | Hard rule 8 for border weights is real on native and nominal on the web. A change to `tokens.border` would move the app and not the site, the same problem A2-01 describes for spacing. | Replace with `border-l-rule`/`border-thick` (primitives included), and extend `no-raw-design-values` to flag `border(-[trblxy])?-[0-9]` in `apps/web/**`, proven on a broken example in `checks.test.mjs`. | The extended guard's `checks.test.mjs` case feeds `className="border-l-4"` and expects a finding (none today). |
| A2-18 | Low | Web: file pickers `apps/web/app/(app)/offers/offers-view.tsx:322`, `modules/modules-view.tsx:186` (copies of `documents/documents-view.tsx:102`); `CallLink` `apps/web/components/campus.tsx:37-47` (copy of `artifacts.tsx:94`); chooser links `campus/university-chooser.tsx:32`; first-week checkbox `components/campus.tsx:258-262`. Native: `CallButton` `apps/native/components/campus.tsx:46-61` (copy of `artifact-card.tsx` crisis `call` style) | Phase 5 adds five more hand-rolled lookalikes of the primitives. Each differs from `Button` a little: `px-4` against `px-5`, no hover state, no busy or disabled look on the file label while `disabled` is set on its input, and a focus ring with no offset (`outline-3`, against the global `outline-offset: 2px`). The chooser link copies `secondary` without `bg-surface`/`hover:bg-sunk`. The web first-week checkbox is a browser-default box at `size-6`, where goals and messages use `size-5` and native uses the token `Checkbox` (24px, `lineStrong`, brand fill), so its colour is the browser's, not the brand's. | Six copies of the primary button style and three checkbox sizes. A fix to `Button` (A2-02) won't reach any of them. | Add `ButtonLink` (for `Link`/`tel:`/`a`), `FileButton` and `Checkbox` to `apps/web/components/ui.tsx` (checkbox: `accent-color: var(--color-brand)`, `size-5` mapped to `space.5` once A2-01 lands). Add `CallButton` to native `ui.tsx`. Replace the copies. | A guard or unit test that `rounded-md bg-brand` appears only in `components/ui.tsx` (6 hits elsewhere today). |
| A2-19 | Low | `apps/native/components/campus.tsx:221-228` (`Checkbox pair="sunk"` in a `surfaceSunk` step panel); `apps/web/components/campus.tsx:275` (`text-muted` in a `bg-sunk` step); `packages/tokens/src/index.ts` `TEXT_PAIRS`/`NON_TEXT_PAIRS` | Phase 5 puts two colour pairs on screen that the token tests don't hold. (1) The native checkbox's `lineStrong` border on `surfaceSunk` measures **3.18:1**, which passes the 3:1 minimum by 0.18 but isn't in `NON_TEXT_PAIRS` (only surface and canvas are). (2) Web `inkMuted` on `surfaceSunk` measures 7.28:1, but it isn't in `TEXT_PAIRS` (native uses `sunk` ink there). | This is the A2-06 lesson: an unlisted pair can silently fail after a colour tweak. Pair (1) has almost no margin: darkening `surfaceSunk` slightly would break it, and nothing would notice. | Add `['lineStrong','surfaceSunk']` to `NON_TEXT_PAIRS` and `['inkMuted','surfaceSunk']` to `TEXT_PAIRS` (plus a `sunkMuted` native pair). Or keep muted text off sunk panels, as native does. | A tokens test that every pair the apps render is listed. As a minimum, `NON_TEXT_PAIRS` contains `['lineStrong','surfaceSunk']` (fails today). |
| A2-20 | Low | Web `apps/web/components/campus.tsx:62,203` (`text-xl` card titles) vs `offers.tsx:62`, `modules.tsx:248` (`text-lg`); native `apps/native/components/campus.tsx:90,104` (`Heading` for university and campus), `campus.tsx:284` vs `artifact-card.tsx` crisis title (`Heading`, same size) | Card-title hierarchy is inconsistent. On the web, two Phase 5 artifacts title in `text-xl` and two in `text-lg`. On native, `Heading` has one size, so the university name and each campus name under it look the same, and the crisis card's campus section title is as large as the crisis card's own title. | The campus tour is the longest Phase 5 card (campuses × needs × places). Without a step down, a learner scrolling it on a phone can't tell where one campus ends. | Give native `Heading` a `level` (2 → `text.heading`, 3 → `text.bodyStrong`) and use level 3 for campus names and the crisis campus title. Settle on one card-title size on the web (`text-lg` like the other artifacts). | A native campus test asserts a campus name's flattened `fontSize` is smaller than the university name's (equal today). |

## 3. Project-specific checks

| Check | Result |
|---|---|
| Raw colours/sizes in Phase 5 app code | **Pass.** `pnpm check` (all 8 guards) passes. A grep of the Phase 5 diff for hex, `rgb(a)`, numeric `padding/margin/gap/width/height/fontSize/borderWidth/borderRadius` and animation APIs finds only a test fixture (`width: 10` on a fake photo). Web border widths: A2-17. |
| Native colours through tested pairs | **Pass with A2-19.** Every new native text colour comes from `theme.on(pair)` with the right surface (`sunk`/`sunkBrand` in sunk panels, `cardMuted` in cards, `warning` in differences). |
| Touch targets | **Pass (code).** Every new control is `min-h-11` (web) or `minHeight: theme.target` (native), including links, call buttons, contact links and the file pickers. |
| Motion | **Pass.** Nothing in Phase 5 animates on either platform. |
| Draft labels and official sources (hard rule 3 made visible) | **Pass with A2-14.** Campuses, places, calendars, faculty offices, offers' programmes, curricula and deadlines carry `Draft` and a source link on both platforms. Native Plan B misses the badge. |
| Web/native parity of Phase 5 artifacts | **Drift:** A2-13, A2-15, A2-16, A2-20. Content parity (same `en.*` keys, same `packages/ui` artifacts, same API) is good. |
| Both themes from one token set | **Pass.** `packages/tokens` unchanged. Phase 5 adds no theme values. Native `theme.border` and web `--border-width-*` both exist; the web doesn't use them yet (A2-17). |

## 4. Not measured

| Check | Why |
|---|---|
| Rendered comparison, screenshots, the 320/360/768/1024/1440 sweep | Code review only, as briefed; no server or device. The nav widths in A2-12 are estimated from label lengths at the 17px base and `px-3`/`gap-1`, not measured. |
| Native on a device: dynamic type, safe areas, the long campus-tour card | No simulator run. The code uses `minHeight`, never fixed heights. |
| Actual browser rendering of the unstyled first-week checkbox (A2-18) | Varies by browser; not rendered. |
| Contrast as rendered (anti-aliasing, browser default checkbox colours) | Pairs computed with the WCAG formula from the token hexes only. |

No probe tests were written or run in this audit.

## 5. Waived

None.

## 6. Deliberate deviations register

None of these is recorded in a design document, because there isn't one (A2-11). The intent is clear from code
comments, so they should go into that document when it exists:

- **Native copies the module message through the share sheet; the web uses the clipboard**
  (`apps/native/components/my-modules-card.tsx:17-20`). The comment gives the reason: the app has no clipboard module.
  This is platform-appropriate.
- **Native course and programme choosers are a searchable button list, and the reply-by date is typed as
  YYYY-MM-DD; the web uses `<select>` and `type="date"`.** This continues the Phase 4 goals pattern.
- **Native year and term choices are radios behind a disclosure button; the web uses selects**
  (`apps/native/components/confirm-modules.tsx:178-258`).
- **Native shows error notices at the foot of the confirm-modules form, near the button; the web shows them at the
  top.** Defensible, but not recorded.
- **No native letter upload in Phase 5** (`apps/native/app/offers.tsx:27`). This is not recorded in status.md (A2-16).

## 7. Remediation roadmap

- **Quick wins (< 1 day):** A2-13 (badge tone), A2-14 (one badge), A2-15 (pass the param), A2-19 (two pair entries),
  A2-20 (heading level), the chat-card links in A2-16.
- **Medium:** A2-17 (border classes plus the web guard), A2-18 (`ButtonLink`/`FileButton`/`Checkbox`/`CallButton`
  primitives), the rest of A2-16.
- **Structural:** A2-12 (stage-aware navigation on both platforms). This is a design decision, so it belongs with
  A2-11's document, alongside A2-01 and A2-02.

## 8. What's genuinely good

- **One component per artifact, shared by chat and page.** `OfferCard`, `MyModulesCard`, `CampusTour`,
  `FirstWeekCard` (web) and their native twins render the same `packages/ui` artifact in the chat panel and on the
  page, with the page adding actions through `children`. The chat and page versions can't drift apart.
- **Sunk panels use the right pairs on native.** The campus places, first-week steps and crisis lines all switch to
  `pair="sunk"`/`sunkBrand` and `Badge tone="card"`, which is exactly the A2-06/A2-07 lesson applied.
- **Text first, links out.** No map tiles, images or media. Every place has "open in maps", a source link and a
  one-tap dial (`dialable`). This is light on data and matches the identity's "budget phone, outdoors" brief.
- **Draft and provenance are visible everywhere** except A2-14. The calendar, curriculum, faculty office and each
  place carry their own badge and source.
- **Accessible names carry context** (`Accept: <course>`, `Call …: <place>`, `Official source: <course>`), so long
  repeated lists stay usable without changing the visible design.

## Tool runs

- `pnpm check`: all 8 guards pass.
- Contrast (WCAG formula, token hexes): lineStrong/surfaceSunk 3.18, inkMuted/surfaceSunk 7.28, surface/surfaceSunk
  1.20, canvas/surfaceSunk 1.09, line/surface 1.68.
