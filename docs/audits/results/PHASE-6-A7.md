# PHASE-6 — A7 Mobile and native

**Project:** UniversityFlow · **Phase:** 6 (wave 10 audit of #115–#134) · **Date:** 2026-10-25
**Commit:** e09ad5b4 · **Audit source:** tumoOLO_Audits @ 29eafd7 (`audit.mjs brief A7`)
**Result:** 0 Critical · 0 High · 1 Medium · 1 Low · 0 waived · device, store and performance checks not measured

## Scope

- Commits `c0e1545c..e09ad5b4`. What reached the app: #129 (Phase 6c: `app/module/[code].tsx`,
  `components/module-card.tsx`, `components/mark-calculator.tsx`, the "Open card" button in
  `components/my-modules-card.tsx`, the route in `components/gate.tsx`), the packages it bundles
  (`@universityflow/admissions/client`, `@universityflow/ui` barrel with `mark-calculator.ts` and
  `module-card.ts`, `@universityflow/content/app` with `moduleCard`), and #132's root overrides.
- Read: those files, `apps/native/package.json`, `packages/{admissions,ui,content}/package.json`,
  `packages/admissions/src/client.ts`, `packages/ui/src/mark-calculator-entry.test.ts`,
  `packages/content/src/{app,app-en}.ts` diffs, the lockfile diff, the last `main` CI run's log.
- The brief's device, store and performance sections apply to the whole app; nothing in scope
  changed them, and no device was available (see Not measured).

## Method

- `pnpm check` (guards, no lock): all 11 pass, including `no-dom-in-shared-packages` (hard rule
  11), `native-lists-workspace-deps` (gotcha 14), `native-no-catalogue-barrel`,
  `native-no-content-barrel`, `one-zod`.
- Native jest under a suite lock (`uf-suite-lock-2`): **41 suites, 475/475 passed** (status's
  last count 470 before #129's module-card tests).
- Native bundle budget from CI, not `expo export`: run 40133050893 (CI on `main` at e09ad5b4,
  2026-10-24 21:10Z), job "native bundle budget".
- Every import in `apps/native/{app,components,lib}` listed and traced to its package entry.
- Lockfile diff searched for `expo`, `react-native`, `@react-native`, `hermes`, `metro`.

## Results

**Native bundle budget (CI run 40133050893, verbatim):**

```
android  3587.9 KB, 1549.8 KB gz (baseline 3476.7 KB, +111.2 KB)
ios      3353.9 KB, 1461.2 KB gz (baseline 3242.7 KB, +111.3 KB)
✓ 2 native bundles within 5% of the baseline, none with catalogue data or zod's locales
```

That is 64% of Android's 5% (173.8 KB) and 69% of iOS's (162.1 KB): about 51 KB left on iOS.
#124 stood at +48.4 KB, so #129 (module card and calculator) cost about 63 KB. One more feature of
that size will cross the budget: plan the next deliberate rebaseline (or a trim) with Phase 6e
rather than discover it on a PR. Not a finding.

**Does a merged change need a new app build?** No. `apps/native/package.json`, `app.json` and
`eas.json` are unchanged in scope; the lockfile changes no `expo-*`, `react-native*` or Metro
package; #132's `@expo/cli>zod` override is the build tool, not the bundle. #129 is JavaScript
only. The build already owed for A7-22 (dev client) and A7-23 (camera wording) is still owed.

## Findings

| ID | Audit | Severity | Location | Finding | Status | Plan |
|---|---|---|---|---|---|---|
| A7-24 | A7 | Medium | apps/native/components/mark-calculator.tsx:96, 111 (and apps/web/components/mark-calculator.tsx:123, 147) | The mark fields use `keyboardType="decimal-pad"` (web: `inputMode="decimal"`), but the hint asks for "a score, like 18/24" (content module-card.ts:133) and `parseMark` takes one. iOS's decimal pad has no "/" key and most Android number pads don't either, so the score form can't be typed on a phone; the workaround is to work out the percentage yourself, the arithmetic the calculator exists to do | Open | `numbers-and-punctuation` on iOS and the default keyboard on Android for these fields (web: `inputMode="text"` with `enterKeyHint`), or a separate "out of" field; an RNTL test pinning the keyboard type, and a device check |
| A7-25 | A7 | Low | apps/native/components/mark-calculator.tsx:53, 127 | The result is announced twice on Android (`useAnnounce(view.summary)` and the `accessibilityLiveRegion="polite"` view around it) and once per keystroke on both (typing "62" announces after "6" and again after "62") | Open | One channel per platform (the live region on Android, a debounced announcement on iOS, as A3-02 intended), checked with TalkBack and VoiceOver |

## Holds (checked and sound)

- **Gotcha 14.** The app reaches admissions, catalogue, content, tokens and ui, and lists all
  five (`apps/native/package.json:20-24`); the guard passes.
- **Nothing web-only in the bundle.** The app imports `@universityflow/admissions/client`
  (mark maths, `export type` only from `assessment.ts`, so no catalogue at runtime), the `ui`
  barrel (whose new `module-card.ts` imports only types from admissions and catalogue, and
  `moduleCard`/`modules` from `content/app`), `catalogue/client` and `content/app`. The
  `admissions` barrel appears only in `import type` (results, programme card, what-i-need,
  school record, types.ts). The budget's own check finds no catalogue data or zod locale.
- **Free-book words stay out of the app.** `content/app` exports `moduleCard` but not
  `freeBooks` (app.ts:46-48, app-en.ts:98-102); the server words a card's books.
- **Hard rule 11.** `packages/ui/src/{mark-calculator,module-card}.ts` and
  `packages/admissions/src/{client,mark-needed}.ts` use no `window`, `document`, `navigator` or
  Node built-in (guard passes; the calculator says so in its header).
- **Hard rule 8 in the app.** No literal user-visible string in any native file changed in scope
  (a scan of JSX text and label/hint/title/accessibility attributes found none); titles, labels
  and the "Open card" button come from `en.moduleCard`.
- **The calculator works offline.** It runs `calculate` on the resolved scheme the card carries;
  only Save calls the network, guarded against double submits (`inFlight`), with an error notice.
- **Links on the card are safe.** A lecturer's email is `mailto:` from an address the confirm
  schema already validated (work address only), a phone is `tel:` stripped to digits and `+`
  (packages/ui module-card.ts:455-460); both open with `Linking.openURL(...).catch()`.
- **Touch targets.** The card's links and the modules card's links use `minHeight: theme.target`
  (module-card.tsx:233, my-modules-card.tsx:363); buttons are the shared `Button`.
- **No animation** in the new screens, so nothing to reduce (hard rule 9).
- **Deep link to a card.** `/module/[code]` encodes both params into the API path and shows
  `en.moduleCard.notFound` for another learner's or a missing module (the server's 404).

## Not measured

- Every device check in the brief (sections 1–6 on physical iPhone and Android: navigation,
  safe areas, 320/360dp, keyboard avoidance on the calculator, Dynamic Type 200%, VoiceOver and
  TalkBack order, cold start, FPS): no device in this environment. A7-24 and A7-25 are from the
  code and the platforms' documented keyboards, not seen on a phone.
- Store readiness (section 7) and build health (section 8: `expo-doctor`, EAS builds): nothing in
  scope changed them; not re-run.
- `expo export` (forbidden to this agent); the budget numbers are CI's.

## Remediation roadmap

- **Quick:** A7-24 (keyboard type, test, device check); A7-25 (one announcement channel).
- **Next phase:** rebaseline the native budget deliberately before Phase 6e adds more screens.

## What's genuinely good

- Phase 6c added a whole new screen and calculator to the app for about 63 KB, with the catalogue
  and the free-book words kept out by subpaths that tests and the budget both hold.
- The same view model (`moduleCardView`, `calculate`) drives web and app, so the app's numbers
  can't drift from the web's.
- No new native module and no new build: the module card ships with the next build already owed.
