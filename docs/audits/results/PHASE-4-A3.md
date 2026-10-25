# PHASE-4 — A3 Accessibility (WCAG 2.2 AA)

**Project:** UniversityFlow · **Phase:** 4 · **Date:** 2026-10-14
**Commit:** 7d53bc6 (branch `phase-4/audits`) · **Audit source:** tumoOLO_Audits @ 29eafd7
**Result:** 0 Critical · 0 High · 3 Medium · 6 Low · 0 waived · 5 not measured

**Scope:** the UI Phase 4 added or changed (`git diff 17ca607..7d53bc6 -- apps/`). Web: My goal and exams
(`app/(app)/goals/*`, `components/goals.tsx`), free practice (`components/practice.tsx`), What I need
(`components/what-i-need.tsx`, `results/what-i-need/[programmeId]/page.tsx`), the recheck card, messages opt-in
(`me/messages-card.tsx`) and the new chat artifacts. Native: `app/goals.tsx`, `app/what-i-need/[programmeId].tsx`,
`app/notifications.tsx` (push opt-in), `app/upload.tsx` + `components/confirm-marks.tsx` (camera, gallery and PDF
upload), `app/account.tsx` (account deletion), `components/{goals,practice,what-i-need,recheck-card,programme-card,gate}.tsx`.
This is the first A3 run. The template's KI items come from a marketing site, and most of them do not apply here (see §3).

## 1. Executive summary

**Verdict: does Phase 4 pass WCAG 2.2 AA? No, with 0 blocking failures.** Three Medium failures (2.4.3, 4.1.3,
1.3.1/3.3.1) are not gate-blocking. The web side is solid. axe is clean on every Phase 4 page, under reduced motion
too. Every new colour pair passes when measured. Nothing new animates. The pages reflow at 320 CSS px with no
horizontal scroll, even with the 1.4.12 text-spacing override. The defects sit where axe can't see them: **focus
handling and announcements**. On the web, the My goal page drops keyboard focus to `<body>` on its two main actions.
On native, the app announces errors and outcomes only on Android. `accessibilityRole="alert"` and
`accessibilityLiveRegion` do nothing on iOS. On the confirm-marks screen (hard rule 6), `aria-invalid` is a no-op in
RN 0.86.2, so a field in error is not exposed as invalid.

Top risks:
1. Focus is lost on **My goal** after "Make this my goal", "Remove my goal" or an exam-subject toggle (A3-01).
2. **iOS VoiceOver** gets no announcement for upload errors, mark validation errors, push outcomes or "Saved" (A3-02).
3. **Confirm marks (native)**: invalid state isn't exposed, and seven identical "Mark (%)" fields (A3-03).
4. A denied push permission is reported as an `info` Notice, which is silent on Android too (part of A3-02).
5. Static `id`s on Phase 4 artifact cards collide when the chat shows the same artifact twice (A3-06).

## 2. Findings

| ID | Severity | Location | WCAG | Finding | Why it matters | Fix |
|---|---|---|---|---|---|---|
| A3-01 | Medium | `apps/web/app/(app)/goals/goals-view.tsx:132-142, 164` | 2.4.3, 2.4.7 | The focused control is disabled (`disabled={busy}`, or `choice === goal.goalId` after a save) or unmounted ("Remove my goal" after clearing) while the request runs. **Measured in Playwright:** after Space on an exam-subject checkbox, and after Enter on "Make this my goal", `document.activeElement` is `BODY`. | Chrome keeps a sequential-focus starting point, so Tab still moves on. Screen readers (NVDA/JAWS virtual cursor, TalkBack on Android Chrome: the target users) lose their place and may restart from the top. This happens on every save on the page. | Don't disable the control that holds focus. Use `aria-disabled` and ignore presses while `busy`. After a save that removes or disables the trigger, move focus on purpose (`ref.focus()` to the Goal card heading with `tabIndex={-1}`, or to the status line). |
| A3-02 | Medium | `apps/native/components/ui.tsx:178-189` (Notice), used by `app/upload.tsx:37,50,128`, `components/confirm-marks.tsx:206`, `app/notifications.tsx:41-50`, `app/goals.tsx:135-140`, `app/account.tsx:47` | 4.1.3, 3.3.1 | Notices rely on `accessibilityRole="alert"` and `accessibilityLiveRegion`. `accessibilityLiveRegion` is Android-only, and RN's `alert` role triggers no announcement on iOS. The only `AccessibilityInfo.announceForAccessibility` call in the app is in `chat.tsx:99`. So on iOS these all appear silently: "camera access denied", "couldn't read the page", "these marks don't look right", "Saved" on My goal, and a failed delete. On **both** platforms, push `denied` / `no-device` / `unavailable` is shown as `tone: 'info'` (`liveRegion 'none'`, no role). | A VoiceOver user taps a button and hears nothing; the button simply returns to its label. They have to hunt the screen to learn whether it worked. After a photo, the switch to the confirm-marks view is not announced either. | In `Notice`, call `AccessibilityInfo.announceForAccessibility(text)` in an effect when a danger or warning notice mounts or its text changes. Do the same for the goals "Saved" status, for `turnOn()` results that aren't `'on'`, and when `upload.tsx` switches to ConfirmMarks (announce its title). Treat a denied permission as `warning`, not `info`. |
| A3-03 | Medium | `apps/native/components/ui.tsx:156-170`; `apps/native/components/confirm-marks.tsx:172-187` | 1.3.1, 3.3.1, 2.4.6 | `aria-invalid` on `TextInput` is ignored. **Verified:** it is absent from RN 0.86.2's `Libraries/` (TextInput maps only `aria-busy/checked/disabled/expanded/selected/label/labelledby/hidden`). The error isn't in the input's label or hint, so a mark field in error reads as a plain "Mark (%)". Every row's field has the same label, "Mark (%)", with the subject only on a neighbouring button. | On the hard-rule-6 confirmation screen, a screen reader user moving by form field hears "Mark (%)" seven times and can't tell which subject a field belongs to, or which one is wrong. Linear swiping gives the context, so there is a workaround, which is why this is Medium. | Label each field with its row: `${en.confirm.percent}, ${subjectName or "Subject n"}`. When `error` is set, put it in the input's `accessibilityHint` (or append it to the label). Remove the no-op `aria-invalid`. The web confirm form uses the same "Mark (%)" label on every row; fix both together. |
| A3-04 | Low | `apps/web/app/(app)/me/messages-card.tsx:70-91, 111-115` | 1.3.1, 4.1.3 | Each channel's explanation ("On since …", "You turned this off by replying STOP", and the reason the **push checkbox is disabled**) is a sibling `<p>` with no `aria-describedby`. **Measured:** `describedby=null` on all three, and push is `disabled=true`. The "Saved" `role="status"` is mounted together with its text (0 status regions before the change, 1 after), which screen readers often skip. | A screen reader user meets a disabled "App notifications" checkbox with no reason attached. The confirmation may not be spoken. | Give each hint an id and point the checkbox's `aria-describedby` at it. Render the `role="status"` element always and change only its text (as `goals-view.tsx:93` already does). |
| A3-05 | Low | `apps/web/components/goals.tsx:27-28, 67-68`; `apps/web/components/practice.tsx:25-26` | 4.1.2 (robustness), best practice | `goal-card-title`, `exam-countdown-title` and `practice-title` are fixed ids. In chat, asking twice renders two `section[aria-labelledby="exam-countdown-title"]`. **Measured:** count 2 for both exam countdown and practice. axe best-practice `landmark-unique` flags both. | Duplicate ids: the second region takes its name from the first heading. Two identical "Exam countdown" landmarks appear in the landmark list. | Use `useId()` for the heading id, as `WhatINeedCard` already does with its per-programme id. |
| A3-06 | Low | `apps/native/components/programme-card.tsx:67-73` | 2.4.4, 2.4.9 | Every programme card has a "What I need for this course" button. The course name is only in `accessibilityHint`, which VoiceOver users can turn off and Voice Control ignores. The web adds an `sr-only` course name (`apps/web/components/programme-card.tsx:101-104`). | The same label repeats down the results list with no way to tell the buttons apart out of context. | Put the course name in the accessible label (`${en.whatINeed.open}: ${result.name}`), keeping the visible text short. |
| A3-07 | Low | `apps/native/components/confirm-marks.tsx:110-129, 140-149` | 1.3.1, 4.1.2 | The four report-kind `radio` pressables have no `radiogroup` parent (the onboarding radios do: `onboarding.tsx:225`). The subject button toggles an inline picker but exposes no `expanded` state. | TalkBack doesn't announce "1 of 4" or the group name. A screen reader user isn't told that the subject list opened. | Wrap the radios in `<View accessibilityRole="radiogroup" accessibilityLabel={en.documents.kind}>`. Add `accessibilityState={{ expanded: picking === row.key }}` to the subject button (the shared `Button` needs an `expanded` prop). |
| A3-08 | Low | `apps/native/components/practice.tsx:60-64`; `apps/web/components/practice.tsx:34-56` | 1.4.3 (guard gap) | Practice links are brand text on `surfaceSunk`. **Measured: 6.50:1, passes.** But the pair isn't in `TEXT_PAIRS`, and native sets the colour directly instead of through `theme.on(pair)`. The theme says every on-screen pair is a tested one. | A future token change could take this pair below 4.5:1 with no test failing. | Add `['brand','surfaceSunk']` to `TEXT_PAIRS`, plus a `sunkBrand` pair in `lib/theme.ts` used by the practice link. |
| A3-09 | Low | `apps/native/app/account.tsx:29-31` | 4.1.3 | After a successful delete, the token is cleared and the gate swaps to sign-in with nothing said. | A screen reader user isn't told that the account was deleted, only that they're on a sign-in screen. | `AccessibilityInfo.announceForAccessibility(en.me.deleted)` (new content string) before `clearToken()`. |

## 3. Regression check (template KIs)

- **KI-01 (no white text on orange):** confirmed fixed. The only warm surface is `accent` #F2B230, always with
  `onAccent` #1B1B1F (**9.15:1**). The Phase 4 days-left badge uses it, on web and native.
- **KI-02 (FAQ accordion):** N/A. There is no accordion. The native subject picker is the nearest thing (A3-07).
- **KI-03 (pointer-only thumbnails):** N/A. There are no thumbnails, and every Phase 4 control is a real button,
  link or checkbox.
- **KI-04 (reduced motion):** confirmed. Phase 4 adds no animation. Web durations drop to 0 ms under
  `prefers-reduced-motion` (`globals.css:91-106`, tokens `toCss`). Native uses `animation: 'none'` on the stack
  (`gate.tsx:39`) and has no Animated API. axe ran with `reducedMotion: 'reduce'` on `/goals` and all content was
  final and visible.
- **KI-07 (alt text):** N/A for Phase 4 web (no images added). The native icons are app or notification assets,
  not in-app content.
- **KI-09 (count-ups):** confirmed absent. The exam countdown shows a static "N days" badge.

## 4. Measurements

**E2E (Playwright + axe, Pixel 7, production build):** 8/8 passed (1.1 min). That includes the Phase 4 journeys:
goal + countdown + practice, recheck + What I need, and SMS opt-in → STOP. Each runs axe with WCAG 2.0/2.1/2.2 A/AA
tags. Run with the repo's config cloned onto port 3117 (A4 may hold 3100), against the existing `.next` build. The
throwaway config and a probe spec (`phase4.audit-tmp.spec.ts`) were deleted afterwards.

**Probe spec (throwaway) results:**
- axe (WCAG A/AA + best practice) on `/goals` with and without a goal, `/results/what-i-need/uj-beng-civil` at
  320 px, `/me` after opt-in, and the chat with repeated artifacts. **No WCAG violations.** Best practice found only
  `region` on the preview-only draft banner (`(app)/layout.tsx:33`, never shown in production) and `landmark-unique`
  (A3-05).
- Reflow at 320 CSS px: `/goals`, `/results/what-i-need/…` and `/me` have `scrollWidth == clientWidth == 320`. With
  the 1.4.12 override (line-height 1.5, letter 0.12em, word 0.16em, paragraph 2em) `/goals` still fits. The What I
  need table is 246 px wide inside its 246 px scroller, so no 2-D scroll is needed.
- Focus: see A3-01. The messages-card SMS checkbox keeps focus after Space (it isn't disabled).
- `<h1>`: one per page. Titles are "My goal and exams · UniversityFlow" and "What I need · UniversityFlow".

**Contrast** (computed with the WCAG formula from `packages/tokens` values; every Phase 4 surface is opaque, so
there is no compositing):

| Pair | Ratio | Where |
|---|---|---|
| brand / surfaceSunk | 6.50 | practice links in the sunk subject boxes (A3-08) |
| ink / surfaceSunk | 14.29 | exam paper rows, practice rows |
| inkMuted / surface | 8.75 | hints, "On since", recheck lead |
| onAccent / accent | 9.15 | days-left badge |
| success / successSoft | 6.04 | "Free" access badge |
| warning / warningSoft | 6.37 | "Not yet verified" badge and notices |
| ink / infoSoft, warningSoft, successSoft | 14.39 / 15.06 / 14.81 | Notice body text (web) |
| focus / surfaceSunk | 5.58 (non-text) | focus ring on links inside sunk rows |
| focus / surface, canvas | 6.70 / 6.10 (non-text) | focus ring elsewhere |
| lineStrong / surface | 3.82 (non-text) | select borders on My goal |
| brand / surface | 7.81 (non-text) | native checkbox box border and fill (`goals.tsx:36-45`) |
| disabled primary button (60% opacity) | 3.01 | exempt (inactive control, 1.4.3) |

**Native:** `pnpm --filter @universityflow/native test` ran 16 suites, 115/115 passed. From the code: every new
control is a `Button` (role `button`, label, `disabled`/`busy` state, `minHeight` and `minWidth` 44) or a `Check`
(role `checkbox`, `checked`/`disabled` state, `minHeight` 44). Practice links have role `link` and a 44 minimum
height. No `numberOfLines`, no fixed heights and no `maxFontSizeMultiplier`, so text can scale.

## 5. Not measured

1. **Screen-reader read-through and transcript** (NVDA, VoiceOver, TalkBack): no screen reader or device in this
   environment. Announcement behaviour in A3-02 and A3-03 comes from RN 0.86.2 source and documented platform
   behaviour, not a device run.
2. **Native on device**: touch targets were checked from styles, not measured on screen. Dynamic Type / font scale
   at 200% and header-title truncation not checked.
3. **Real browser zoom** at 200% and 400%: approximated by a 320 CSS px viewport (the 1.4.10 equivalent).
4. **OS-owned UI**: the camera, photo picker, document picker and the push-permission dialog are system screens.
5. **Lock-screen notification content**: needs real push credentials (D8).

## 6. Waived

None.

## 7. Remediation roadmap

- **Quick wins (< 1 day):** A3-05 (`useId`), A3-06 (label), A3-07 (radiogroup + expanded), A3-08 (add the pair),
  A3-09 (one announce), A3-04 (describedby + persistent status).
- **Medium:** A3-02 (announce in `Notice` plus the three call sites, with a jest spy on `announceForAccessibility`),
  A3-03 (row-aware labels + error in hint, web and native), A3-01 (aria-disabled + focus restore; Playwright
  `document.activeElement` assertion).
- **Structural:** add a focus and announce assertion to the shared E2E helper, so that every journey checks focus
  isn't on `<body>` after an action, alongside axe.

## 8. What's genuinely good

- `goals-view.tsx:93`: a **persistent, empty `role="status"`** that only changes text. This is the right pattern;
  copy it to the messages card.
- Practice and source links say "opens in a new tab" in `sr-only` text, and the web "What I need" link adds the
  course name for screen readers (`programme-card.tsx:101-104`).
- The What I need table has a caption, `scope="col"` headers and `th scope="row"` subject cells. The gap is a
  number and a word, never only weight or colour.
- The exam countdown is an `<ol>` with static day counts: no ticking timer and no count-up.
- Native `Button` exposes `busy` and swaps its label to the busy label, so "Reading…" and "Saving…" are spoken.
- Account deletion asks the learner to type DELETE before the button enables (3.3.4), and works before consent.
- Every Phase 4 text pair measures ≥ 6:1. The token test suite proves the pairs it lists.
