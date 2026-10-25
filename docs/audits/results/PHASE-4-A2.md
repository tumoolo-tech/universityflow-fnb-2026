# PHASE-4 — A2 Design fidelity

**Project:** UniversityFlow · **Phase:** 4 · **Date:** 2026-10-14
**Commit:** 7d53bc6 (branch `phase-4/audits`) · **Audit source:** tumoOLO_Audits @ 29eafd7
**Result:** 0 Critical · 0 High · 4 Medium · 7 Low · 0 waived · 4 not measured

**Scope:** the screens Phase 4 added or changed (`git diff 17ca607..7d53bc6 -- apps/ packages/ui packages/tokens`).
Web: My goal and exams (`apps/web/app/(app)/goals/*`, `components/goals.tsx`), free practice
(`components/practice.tsx`), What I need (`components/what-i-need.tsx`, `results/what-i-need/[programmeId]/page.tsx`),
messages opt-in (`me/messages-card.tsx`), the recheck card, and the artifact additions. Native: `app/goals.tsx`,
`app/what-i-need/[programmeId].tsx`, `app/notifications.tsx` (push opt-in), `app/upload.tsx` + `components/confirm-marks.tsx`
(camera upload), `app/account.tsx` (account deletion), `components/{goals,practice,what-i-need,recheck-card}.tsx`.
`packages/tokens` did not change in Phase 4; `packages/ui` changed only in artifact types.

**Design reference used.** The runner had no `config.designReference`. There is no design document under `docs/`
(no `design-system.md`, `brand.md` or `known-issues.md`). The reference is therefore:
`packages/tokens/src/index.ts` (the visual identity, planning.md Q16; generated to `packages/tokens/tokens.css`),
`apps/native/lib/theme.ts` (its RN derivation), `apps/web/app/globals.css` (its Tailwind mapping), the decision rows in
`status.md` (lines 117, 134), planning.md §16 ("Tailwind v4 from generated tokens") and CLAUDE.md hard rules 8–9.

**Not applicable.** Most of the shared A2 checklist (12 landing sections, bokeh background field, zero-radius tokens,
`.42em` eyebrow tracking, kerf logo, glow elevation) describes another project's reference site. UniversityFlow is an
app with a deliberately different identity (non-zero radii, system fonts, no display type). Those checks were skipped
as not applicable and are not counted as passes or as not measured. Finding A2-11 proposes an overlay
(`docs/audits/A2.project.md`) so the next run doesn't get them.

---

## 1. Executive summary

**Fidelity verdict: minor drift.** Colours are clean: no hex or colour function anywhere in Phase 4 app code
(`pnpm check` → `no-raw-design-values` passes), every native screen takes colour, spacing, radius, type and the touch
target from `theme`, and nothing in Phase 4 animates on either platform. The drift is structural rather than
cosmetic: the web app's spacing scale is Tailwind's default, not the token scale, and the two apps map the same
tokens onto their primitives differently. So the same Phase 4 screen differs between web and phone, in ways nothing
written down says are intended.

Top risks:
1. **A2-01:** web spacing and sizing come from Tailwind's built-in scale, not `tokens.space`. They agree up to step 4
   and diverge after that (`5` is 1.25rem on the web and 1.5rem in tokens).
2. **A2-02:** Card, Button, Input, Badge and Notice differ in radius, padding, border and tone treatment across platforms.
3. **A2-03:** native account deletion is a green primary button; the web's is a red danger button.
4. **A2-04:** Phase 4 hand-rolls two native form controls; the new radio's unselected boundary is `line`, 1.68:1 on white.
5. **A2-05:** dimensions have no guard: only colours are checked, so raw `borderWidth: 2` and similar pass.

## 2. Findings

| ID | Severity | Location | Finding | Why it matters | Fix |
|---|---|---|---|---|---|
| A2-01 | Medium | `apps/web/app/globals.css:5-39`; Phase 4 uses at `apps/web/app/(app)/goals/goals-view.tsx:90,162,175,181`, `apps/web/app/(app)/me/messages-card.tsx:74,81`, `apps/web/app/(app)/results/what-i-need/[programmeId]/page.tsx:41`, `apps/web/components/ui.tsx:30,104` | `@theme` maps colours, text sizes, radii and widths but **no spacing**, so every `p-/m-/gap-/size-/min-w-` utility uses Tailwind's default `--spacing: 0.25rem` multiples. `--uf-space-*` is referenced 3 times in all of `apps/web` (skip link only). Token steps 5–8 are 1.5/2/3/4rem; Tailwind 5–8 are 1.25/1.5/1.75/2rem. Measured on Phase 4: the web exam-subject checkbox is `size-5` = 20px, the native one `theme.space['5']` = 24px (`apps/native/app/goals.tsx:38-39`); web Card padding `p-5` = 20px vs native 16px; `min-h-11` equals `--uf-target` by coincidence, not derivation; `max-w-3xl` (48rem) bypasses `--container-prose`/`--container-page`. | Hard rule 8 ("every design value from packages/tokens") holds for web colour only. A change to `tokens.space` moves the phone and leaves the web unchanged, and planning.md §16 says the web uses "Tailwind v4 from generated tokens". | In `@theme inline`, reset the default scale (`--spacing: initial`) and map `--spacing-0..8: var(--uf-space-N)` plus `--spacing-target: var(--uf-target)`; replace `min-h-11` with `min-h-target`, and `max-w-3xl` with `max-w-page`/`max-w-prose`. Expect visual changes wherever `5`–`8` steps are used today, so review them in one pass. |
| A2-02 | Medium | Web `apps/web/components/ui.tsx:30,78,104,120,147`; native `apps/native/components/ui.tsx:240-277`; Phase 4 panels web `components/goals.tsx:85`, `components/practice.tsx:36` vs native `components/goals.tsx:77-82`, `components/practice.tsx:34-39` | The same tokens are mapped differently per primitive. **Card:** web `radius.lg` (20px), 20px padding; native `radius.md` (12px), 16px. **Button:** web 20px side padding, secondary on `surface`; native 16px, secondary on `canvas` (pair `pageBrand`, so a tinted chip on a white card). **Input:** web 2px `lineStrong`, `radius.md`; native 1px, `radius.sm`. **Badge:** web pill (`rounded-full`, 12px padding); native `radius.sm`, 8px. **Notice:** web 4px tone-coloured left rule with ink text; native no rule, tone-coloured text. Phase 4 panels (exam papers, practice subjects): web `radius.md`, native `radius.sm`. | Phase 4 doubled the number of screens that exist on both platforms. Each mismatch is small, but together they make the two apps look like two products, and none is recorded as a decision (see A2-11). | Decide one mapping per primitive and record it as component tokens in `packages/tokens` (e.g. `component.card = { radius: 'lg', padding: '5', border: 'thin' }`), consumed by both `theme.ts` and `globals.css`. Then make both `Card`/`Button`/`Input`/`Badge`/`Notice` read them. |
| A2-03 | Medium | `apps/native/app/account.tsx:38,48-54`; `apps/native/components/ui.tsx:84,96-116`; web counterpart `apps/web/app/(app)/me/me-view.tsx:138,150-156` | Native account deletion uses the default **primary** (brand green) button and a normal heading. The web uses `variant="danger"` (red) and a `text-danger` heading. Native `Button` has no danger variant at all. | An irreversible action is styled as the screen's main positive action, on the flow the stores require in-app, and it differs from the web. | Add a `danger` variant to the native `Button` (`backgroundColor: theme.color.danger`, text `onBrand`; add `['onBrand','danger']` to `TEXT_PAIRS`: 6.5:1, and the web's `bg-danger text-on-brand` uses the same untested pair today) and a `pair="danger"`-style heading. Use both in `account.tsx`. |
| A2-04 | Medium | `apps/native/components/confirm-marks.tsx:112-129`; `apps/native/app/goals.tsx:21-51`; existing pattern `apps/native/components/onboarding.tsx:234-240,259-273` | Phase 4 adds two hand-rolled controls outside `components/ui.tsx`. The **report-kind radio** shows selection only by recolouring a 2px border from `line` to `brand`, with no dot. Its unselected boundary is `line` (#CFC7B4), **1.68:1 on surface**, below the 3:1 non-text minimum that `NON_TEXT_PAIRS` holds `lineStrong` to (3.82:1) for control borders. It also differs from the app's existing radio in onboarding (`lineStrong` ring, brand dot). The **checkbox** is a filled/empty square with a raw `borderWidth: 2`. The web uses native `<select>`/`<input type=checkbox>`. | This is the third radio style in the app. The unselected options barely read as controls in sunlight, which is the condition the identity is designed for (status.md row 134). This overlaps A3. | Extract `Radio` (onboarding's dot pattern, `lineStrong` ring) and `Checkbox` into `components/ui.tsx`, and use them in confirm-marks, goals and onboarding. |
| A2-05 | Low | `scripts/checks/no-raw-design-values.mjs:11-20`; `apps/native/app/goals.tsx:40`; `apps/native/components/confirm-marks.tsx:123`; (pre-existing `ui.tsx:248,256,272,277`, `chat.tsx:242,257`); web `border`/`border-2`/`border-l-4` | There is no border-width token, so border weights are raw numbers on both platforms. The guard checks only hex and colour functions, so raw dimensions in native style objects (`borderWidth: 2`, and any future `padding: 13`) pass `pnpm check`. | Hard rule 8 is only half-guarded. Phase 4 added two more raw widths. | Add `tokens.border = { thin: '1px', thick: '2px', rule: '4px' }`, mapped in `theme.ts` and `@theme`. Extend the guard to flag numeric literals on `borderWidth|padding*|margin*|gap|borderRadius|fontSize|lineHeight|width|height` in `apps/native/**` style objects (`check-ignore` stays the escape hatch). |
| A2-06 | Low | `apps/native/components/practice.tsx:60-64`; `apps/web/components/practice.tsx:49-57` (inside `bg-sunk`, line 36); `apps/web/components/ui.tsx:34` | Phase 4 puts brand link text on `surfaceSunk`, a pair **not in `TEXT_PAIRS`**. The native code bypasses `theme.on(pair)` and reads `theme.color.brand` directly. Measured at 6.50:1, so it passes today, but no test holds it. The same applies to `onBrand` on `danger` (web danger button). | The token tests only protect listed pairs. A future colour tweak could silently fail AA here. | Add `['brand','surfaceSunk']` and `['onBrand','danger']` to `TEXT_PAIRS`, add a `sunkBrand` pair to `theme.ts`, and use `theme.on('sunkBrand')` in native practice. |
| A2-07 | Low | `apps/native/components/practice.tsx:70,72` (Badge default tone `sunk`, inside a `surfaceSunk` panel at :38); `apps/web/components/practice.tsx:59` (neutral Badge `bg-sunk` inside `bg-sunk` li at :36) | Neutral badges sit on a panel of the same colour (1.0:1), so "Textbook"/"Grade 12" render as loose text beside the coloured success/warning chips. | The chip hierarchy breaks in the one Phase 4 component that uses most chips. | Inside sunk panels, use a surface-coloured neutral badge (native `tone="card"`; web add a `surface` tone). |
| A2-08 | Low | `apps/native/app/what-i-need/[programmeId].tsx:45-49` | The no-report state still says `en.results.uploadOnWeb`, though Phase 4d added in-app upload and `results.tsx` was updated to `en.documents.uploadLead` plus an Upload button. It is hard to reach (the entry point needs a report), but it is wrong when reached. | It sends the learner to the web for something the app now does. | Mirror `results.tsx:86-89`: `uploadLead` plus `<Button label={en.documents.uploadReport} onPress={() => router.push('/upload')} />`. |
| A2-09 | Low | Native `apps/native/components/goals.tsx:23-53,55-107`, `apps/native/components/what-i-need.tsx:38-96`; web `apps/web/components/goals.tsx:49-57,104`, `apps/web/components/what-i-need.tsx:120-123` | The web shows "Official source" links on the goal card, the exam countdown and What I need (plus the method source). The native views show none: `sourceUrl` appears nowhere in `apps/native`. | Parity: the phone hides the provenance that the web uses to make hard rule 3 visible. Flagged for A13. | Add a `SourceLink` to native `components/ui.tsx` (`accessibilityRole="link"`, `Linking.openURL`, `en.common.officialSource`) and render it where the web does. |
| A2-10 | Low | `apps/web/components/goals.tsx:27,38-40` | The web `GoalCard` wraps `ProgrammeCard`, which is itself a `Card as="li"`, so it renders a card inside a card: two 1px borders and 20+20px padding. At 320px the inner content column loses about 80px. Native avoids it (`GoalCardView` renders `ProgrammeCard` outside a Card). | Cramped and visually noisy on the smallest phones, and inconsistent with native. | Let `ProgrammeCard` render without its card chrome when embedded (`bare` prop), or render the goal header above it rather than around it, as native does. |
| A2-11 | Low | `docs/` (no `design-system.md`, `brand.md`, `known-issues.md`); `docs/audits/` (no `A2.project.md`) | The only design spec is the token file and one status.md row. There is no written component spec and no register of deliberate deviations, and the shared A2 audit runs with another project's checklist. | Without a register, A2 can't tell a decision from drift: A2-02's differences may all be intended, but nothing says so. This is also why the runner reported "missing input: config.designReference". | Write `docs/design-system.md` (tokens → primitives table for web and native, the deliberate platform differences and why), plus `docs/audits/A2.project.md` replacing the inapplicable checks with UniversityFlow's own (token parity, pair coverage, primitives). A person decides the contents. |

### How a failing test would prove each

| ID | Test that fails today |
|---|---|
| A2-01 | A web unit test reads `apps/web/app/globals.css` and asserts `--spacing: initial` plus `--spacing-N: var(--uf-space-N)` for every key of `tokens.space`. Add a guard rule flagging `max-w-[0-9]xl`/`min-h-11` in `apps/web/**`, proven on a broken example in `checks.test.mjs`. |
| A2-02 | A pair of tests, one per app, asserts Card radius/padding equal a shared `tokens.component.card`. Native: `StyleSheet.flatten(card.props.style).borderRadius === toPx(tokens.radius[component.card.radius])` (12 ≠ 20 today). Web: the rendered `Card` class includes the mapped radius class. |
| A2-03 | In `apps/native/__tests__/account.test.tsx`, assert the delete button's flattened `backgroundColor === theme.color.danger` (it is `brand` today). |
| A2-04 | A native ui test renders the confirm-marks radio unselected and asserts `contrastRatio(borderColor, theme.color.surface) >= tokens.contrast.nonText` (1.68 today). |
| A2-05 | A new `checks.test.mjs` case feeds a native file containing `borderWidth: 2` to the extended guard and expects a finding (none today). |
| A2-06 | A native practice test asserts the link's `color` equals `theme.on('sunkBrand').color`, and a token test asserts `TEXT_PAIRS` contains `['brand','surfaceSunk']` (both fail today). |
| A2-07 | Practice tests on both platforms assert a neutral badge's background differs from its panel's (equal today). |
| A2-08 | In `what-i-need.test.tsx`, a `{ result: null }` response expects a button labelled `en.documents.uploadReport` (absent today). |
| A2-09 | Native goals and what-i-need tests expect a link labelled `en.common.officialSource` (absent today). |
| A2-10 | A web component test renders `GoalCard` with a result and asserts there is no element with the card class inside another (two today). |
| A2-11 | Not a code defect. Closed by the documents existing; no regression test needed (Low). |

## 3. Not measured

| Check | Why |
|---|---|
| Rendered side-by-side comparison and screenshots (brief §3 output) | The brief forbids builds and servers in this run (another reviewer owns the build), and there is no reference rendering to compare against. Every finding above comes from reading code and computing values. |
| Responsive sweep 320/375/768/1024/1440/1920, horizontal overflow | Needs a rendered page; not run. A2-10's 320px cost is computed from the classes, not observed. |
| Native on a device or simulator: dynamic type at large sizes, safe areas | No device run. The code uses `minHeight`, never fixed heights, and `theme.text` scales with the system font size (theme.ts:8-10), but this wasn't observed. |
| Touch-target sizes as rendered | Verified only in code: every Phase 4 control has `min-h-11` (web) or `minHeight: theme.target` (native). The web `SourceLink` (`ui.tsx:163`) has no min height, but it predates Phase 4. |

## 4. Waived

None.

## 5. Deliberate deviations register

No deviation between web and native is recorded anywhere (see A2-11). Two are plainly intentional from code comments,
and should be written into the design doc when it exists:

- **Native shows a goal, countdown and practice in full but other artifacts as summaries** (`apps/native/components/artifact-card.tsx:16-20,89-119`, "for now each kind is a titled summary"). It's a staged-scope decision, not drift.
- **Native goal chooser is a searchable button list; web is a grouped `<select>`** (`apps/native/app/goals.tsx:151-186` vs `apps/web/app/(app)/goals/goals-view.tsx:108-130`). Platform-appropriate. Web also has "add a subject"; native doesn't. That's a scope difference that should be recorded.

Everything in A2-02 has no recorded reason, so it counts as drift until a person decides otherwise.

## 6. Remediation roadmap

- **Quick wins (< 1 day):** A2-03 (danger variant), A2-06 (add pairs), A2-07 (badge tone), A2-08 (copy `results.tsx`), A2-09 (native `SourceLink`), A2-10 (`bare` ProgrammeCard).
- **Medium:** A2-04 (shared `Radio`/`Checkbox`), A2-05 (border token and dimension guard), A2-11 (design doc and A2 overlay: a person's call).
- **Structural:** A2-01 (token-driven Tailwind spacing, with a visual pass over every `5`–`8` step) and A2-02 (component tokens shared by both apps). Do A2-11 first so the decision exists before the code follows it.

## 7. What's genuinely good

- **Zero raw colours in Phase 4.** Every web colour is a `@theme` alias of `--uf-color-*`; every native colour comes from `theme.color`/`theme.on(pair)`. `pnpm check` passes all five guards.
- **The native theme is derived, not copied.** `apps/native/lib/theme.ts` converts the token strings (`toPx`, `toMultiplier`, `toWeight`) and throws on anything it can't read. Phase 4 native screens use `theme.space`, `theme.radius`, `theme.text`, `theme.target` throughout; the only raw numbers are the two border widths in A2-05.
- **Colours go through tested pairs.** Native `Body`/`Heading`/`Badge`/`Notice` take a `pair`, so text-on-background combinations are the ones `TEXT_PAIRS` proves AA. Phase 4 components pass the right pair for the surface they sit on (`cardMuted` in cards, `sunk` in sunk panels). A2-06 is the one place that bypasses it.
- **Motion:** Phase 4 adds no animation on either platform (no `Animated`, `LayoutAnimation` or `animate-*`). The web's only transition reads `--uf-duration-normal`, which `tokens.css` drops to 0ms under reduced motion.
- **Touch targets:** every new control is at least the token target (`min-h-11` = 2.75rem web, `minHeight: theme.target` native), including the practice links and the hand-rolled checkbox rows.
- **Same strings, same structure:** web and native Phase 4 views share `en.*` keys and the same server payloads (`GoalCardArtifact`, `ExamCountdownArtifact`, `PracticeArtifact` from `packages/ui`), so content parity is good. The drift is visual only.

## Tool runs

- `pnpm check`: all 5 guards pass.
- `pnpm lint`: 12 errors, all in untracked `*.audit-tmp.*` files written by concurrent reviewers (not in the commit); the
  `packages/db` migration hits are infos. No lint error in committed code.
- Contrast computed with the WCAG formula from `packages/tokens/src/index.ts`: line/surface 1.68, lineStrong/surface 3.82,
  brand/line 4.64, brand/surfaceSunk 6.50.
