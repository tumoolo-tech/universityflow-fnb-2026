# PHASE-5 — A7 Mobile and native

**Project:** UniversityFlow · **Phase:** 5 (Stages 4–5: acceptance, orientation, registration) · **Date:** 2026-10-17
**Commit:** 0554343 (branch `phase-5/stack`, integration trial: main at #76 + #73 + #77 + #78) · **Audit source:** tumoOLO_Audits A7 (brief `audit-brief-A7.md`, Phase 4 text) with the Phase 5 common rules; no `docs/audits/A7.project.md` overlay exists
**Result:** 0 Critical · 0 High · 2 Medium · 4 Low · 0 waived · 11 not measured

Scope: Phase 5's diff in `apps/native` (`git diff 7e8ddef..HEAD`). That covers the new screens
(`app/offers.tsx`, `app/campus.tsx`, `app/first-week.tsx`, `app/modules.tsx`) and their components
(`offer-card`, `campus`, `confirm-modules`, `my-modules-card`, `university-chooser`, the
`artifact-card` additions), proof-of-registration upload by camera, gallery and PDF (`lib/upload.ts`),
the push routes for `offer.reply-by`, `safety.offer-accepted`, `safety.move-in` and
`registration.change-deadline` (`lib/push.ts`, `packages/content/src/messages.ts`), and deep links to
the new screens. It also covers offline and error states, the keyboard on the confirm forms,
store-review implications (permission strings, `docs/store/`) and hard rule 11 for the shared
packages Phase 5 changed (`admissions`, `catalogue`, `content`, `ui`).

**No device, simulator, EAS build or `expo-doctor` run exists for this audit.** It is code review
plus Jest probes only. Everything device-shaped is under Not measured.

Evidence run for this audit:

- A throwaway Jest probe, `apps/native/__tests__/a7-phase5.audit-tmp.test.tsx`, ran alone (8 tests,
  all passed, so the behaviour below is real) and was **deleted** afterwards. It rendered the real
  root layout and auth gate with `expo-router/testing-library`'s `renderRouter`. That needed
  `jest.unmock('expo-router')` and a CLI `--transformIgnorePatterns` that also transforms
  `standard-navigation`. A regression test for A7-13 needs the same two things.
  It proved A7-13 and A7-16. Output:
  - `signed out /offers: sign-in shown=true; pathname=/sign-in` (control). `/modules`: the same.
  - `signed out /campus: sign-in shown=false; pathname=/campus; calls=GET /api/campus`
  - `signed out /first-week: sign-in shown=false; pathname=/first-week; calls=GET /api/first-week`
  - `401 on /campus: sign-in shown=false; pathname=/campus`. `/first-week`: the same.
  - `401 on /offers: sign-in shown=true; pathname=/sign-in` (control)
  - `doneAt 2028-02-01T22:30:00.000Z shows "01 Feb 2028"`. That moment is 00:30 on 2 Feb in South Africa.
- `pnpm check` (the text guards): all 8 pass, including `no-dom-in-shared-packages` (rule 11) and
  `native-lists-workspace-deps` (gotcha 14).
- A grep of every non-test file Phase 5 changed in `admissions`, `catalogue`, `content` and `ui` for
  `window`, `document.`, `navigator`, Node built-ins, `process.` and `Buffer`. The only hits were
  the English word "window" in records and copy.

---

## 1. Executive summary

Phase 5's native work is a faithful, careful port. The four new screens use the same API and server
code as the web. Every load error has a "Try again". The proof-of-registration flow keeps hard
rule 6: every row is shown, editable and removable, and nothing is compared until Confirm. The
upload reuses 4d's fixed file name (`registration.pdf`, never the learner's own) and deletes the
app's cached copy. No new native dependency or permission was added. Notification taps for the
four new templates still go only to a fixed list of screens.

Two Medium defects matter before a store build. First, **My campus and First week are outside the
auth gate.** They were never declared in `Stack.Protected`. A signed-out deep link opens them, and
when the session ends there the learner is stuck: "signed out" plus a "Try again" that can't help,
with no way to sign-in until they kill the app (proved). Second, **the camera and photo-library
purpose strings still say "only … your school report"**. The app now uses both for a proof of
registration, and Apple reviews purpose strings against what the app does.

Top 5 risks:

1. A7-13: a learner whose session ends on My campus or First week is stranded there; signed-out deep links open both screens.
2. A7-14: inaccurate camera and photos purpose strings (App Store 5.1.1). Cheap to fix, and must be fixed before submission.
3. A11-15 (cross-reference): `docs/store/privacy-and-data-safety.md` was not updated for Phase 5's data types. The store forms are built from it.
4. A11-13 (cross-reference): the in-app AI disclosure names only "reports and chat". Letters and proofs now go to the AI provider too (App Store 5.1.2(i)).
5. A7-17: campus security and clinic numbers, safety facts, can't be reached offline. Arrival week is when a learner is most likely to have no data.

### Native-feel verdict: **acceptable** (unchanged from Phase 4)

Native: the system camera and pickers, the share sheet for the suggested message (no clipboard
module added), `tel:` and `mailto:` handed to the phone, the native stack with real transitions
unless Reduce Motion is on, and number pads for credits. What reads most like a web page:

1. Home is now a vertical stack of **twelve** full-width buttons (four added by Phase 5,
   `app/index.tsx:59-75`), where a tab bar or grouped native list would fit.
2. Dates are typed as `YYYY-MM-DD` on a full keyboard instead of a date picker (A7-15).
3. "Open in maps" opens Google's website in Safari on an iPhone without Google Maps (A7-18).

### Store-readiness verdict: **not yet, for reasons outside the native code itself**

- **5.1.1 purpose strings:** A7-14, a content fix.
- **5.1.2(i) third-party AI:** the disclosure and agreement don't name letters or proofs (A11-13).
- **App Privacy / Data safety:** the source page is stale (A11-15). The categories declared today
  happen to cover Phase 5's photos, files and user content, so the forms would not under-declare by
  category. The notes, the AI-processor line and the Physical Address and Financial info answers
  would still be wrong (A11-14 and A11-15).
- **4.2 Minimum Functionality:** lower risk than at Phase 4. Camera reading of a proof of
  registration, one-tap campus security and clinic calls, and offer reminders by push are
  genuinely app-native.
- **2.1 completeness:** the reviewer's account (A7-01, fixed) can open every new screen. Nothing in
  `docs/store/review-notes.md` mentions Phase 5 features. That isn't required, but it helps a
  reviewer who wonders why there is a "My modules" with nothing in it.

---

## 2. Findings

| ID | Severity | Platform | Location | Finding | Why it matters | Fix | Test |
|---|---|---|---|---|---|---|---|
| A7-13 | Medium | both | `apps/native/components/gate.tsx:48-59` (the `Stack.Protected guard={signedIn}` block lists `offers` and `modules` but not `campus` or `first-week`); `apps/native/app/campus.tsx`, `apps/native/app/first-week.tsx`; `apps/native/lib/api.ts:74-77` (a 401 clears the token) | **My campus and First week are not behind the auth gate.** expo-router adds an undeclared route to the stack unguarded, so both screens exist while signed out. **Proved:** signed out, a link to `/campus` or `/first-week` renders the screen and calls its API (sign-in is not shown), while `/offers` and `/modules` redirect to sign-in. **Proved:** signed in on `/campus` or `/first-week`, a 401 clears the session, the gate flips, and the learner stays on the screen (`pathname=/campus`, sign-in not shown). On `/offers` the same 401 lands on sign-in. The stranded learner sees `en.errors.signedOut` and a "Try again" that repeats the 401. Home was removed from the stack with the guard, so there is no back. Android back leaves the app. | Sessions end after 30 days, on sign-out elsewhere, and at the end of a review window (A1-18). A learner reading their campus tour or ticking First week during move-in gets a dead end, and only killing the app recovers. Server data stays protected (every route checks the session), so no data leaks. That is why this is Medium, not High: there is a workaround, but the gate's one job fails for two screens. | Declare `<Stack.Screen name="campus" options={{ title: en.campus.title }} />` and `<Stack.Screen name="first-week" options={{ title: en.firstWeek.title }} />` inside the signed-in `Stack.Protected`. Then make the omission impossible to repeat: a test that every file under `app/` except `_layout`, `+native-intent` and `sign-in` is declared inside the signed-in guard. | Jest with `expo-router/testing-library` (`jest.unmock('expo-router')`, `standard-navigation` added to `transformIgnorePatterns`): no token, `renderRouter({... campus, 'first-week', 'sign-in'}, { initialUrl: '/campus' })` expects sign-in. A token plus a 401 from `GET /api/campus` expects sign-in too. Both fail today. Also a test that reads `app/` and compares it with the screens `Gate` declares, which fails today for `campus` and `first-week`. |
| A7-14 | Medium | iOS (purpose strings); the same words are the in-app explanation on both | `packages/content/src/en.ts:1256-1260` (`permissions.camera`: "UniversityFlow uses the camera **only** when you choose to take a photo of your school report."; `permissions.photos`: "… **only** when you choose a picture of your school report"); mirrored in `apps/native/app.config.ts:22-25` and passed to `expo-image-picker` at `:170-171`; now also used by `apps/native/app/modules.tsx:208-219` (`takePhoto`, `choosePhoto` for a proof of registration) | Phase 5 uses the camera and the photo picker for a **proof of registration** (and planning §11 5d adds offer letters). The `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` the phone shows, and the build ships, still say the app uses them only for a school report. | App Review checks that purpose strings "clearly and completely" describe the use (5.1.1(ii)). A reviewer who opens My modules → Take a photo sees a prompt about a school report: a likely rejection or a metadata question, and an inaccurate statement to a learner at a permission prompt. `app-config.test.ts` keeps `app.config.ts` and content in step, so this needs one wording change. | Reword both in `packages/content` to cover every use without "only … report". For example: "UniversityFlow uses the camera only when you choose to take a photo of a document to upload: your school report, offer letter or proof of registration." Keep `app.config.ts` mirroring it, and rebuild (purpose strings are native config, so an OTA update can't change them). | Content test: `en.permissions.camera` and `.photos` each mention "proof of registration" (and "offer letter" once that upload ships). Fails today. The existing `app-config.test.ts` then proves the plist carries it. |
| A7-15 | Low | both (autocorrect mostly iOS) | `apps/native/components/ui.tsx:185-197` (`Field` passes no `autoCorrect`/`spellCheck`); `apps/native/components/confirm-modules.tsx:212-227` (module code and name); `apps/native/app/offers.tsx:255-263` (reply-by date) | Keyboard on the confirm forms. (1) `Field` can't turn off autocorrect, so the module code field (`autoCapitalize="characters"`) and name field keep the system autocorrect and spell check. Codes such as "ECO 1A" or "ACC 1EA1" can be rewritten on the space bar. (2) The reply-by date is free text in `YYYY-MM-DD` on the full default keyboard, with no date picker and no numeric keyboard. | Each value is still shown before Confirm, so hard rule 6 holds. But a silently "corrected" module code makes the registration check report a wrong difference, and typing a date in ISO form on a phone is web-form behaviour that learners get wrong (the error message catches it). | Add `autoCorrect` and `spellCheck` to `Field`'s allowed props. Set both `false` on code fields (module code, and the course search in `offers.tsx:217-223`, which also lacks `autoCapitalize="none"`). For the date, use a native date picker, or at least `keyboardType="numbers-and-punctuation"` (iOS) / `"numeric"` with the dashes inserted. | Jest: the module-code `TextInput` has `autoCorrect === false` and `spellCheck === false`; the reply-by input has a numeric `keyboardType`, or a date picker is rendered. Both fail today. |
| A7-16 | Low | both | `apps/native/components/offer-card.tsx:24-31` (`formatOfferDate` takes `iso.slice(0, 10)`, the **UTC** date); used for timestamps at `apps/native/components/campus.tsx:240` (`doneAt`) and `offer-card.tsx:82` (`reminderAt`) | `formatOfferDate` is right for plain dates (`replyBy`, `lastDay`). It is also used for **instants**, though, and slicing the ISO string takes the UTC date before the Johannesburg time zone is applied. **Proved:** a step ticked at 00:30 SAST on 2 Feb (`2028-02-01T22:30:00Z`) shows "Done on 01 Feb 2028". | Any tick between midnight and 02:00 shows the wrong day. That is small, but it is a date the app states as fact, and learners use the app late at night. `my-modules-card.tsx:25-34` already formats instants correctly (`formatDateTime`). | Format `doneAt` and `reminderAt` with a timestamp formatter (no slice, `timeZone: 'Africa/Johannesburg'`), and keep `formatOfferDate` for `YYYY-MM-DD` values only. A type or name split (`formatDay` vs `formatInstant`) stops the mix-up. | Jest: render First week with a step `doneAt: '2028-02-01T22:30:00.000Z'` and expect `en.firstWeek.doneOn('2 Feb 2028')` in the locale's format. Fails today. |
| A7-17 | Low | both | `apps/native/app/campus.tsx:21-32, 44-50`; `apps/native/components/campus.tsx:280-301` (crisis campus lines come only inside a chat reply) | **The campus security and clinic numbers can't be reached offline.** My campus fetches the tour on every open and keeps nothing. With no data, the learner sees "You're offline" and "Try again". Planning §11 5b treats these numbers as **safety facts** (verified, like helplines). | A first-year arriving on an unfamiliar campus, often on a prepaid bundle that has run out, is exactly when campus security matters. The screen fails honestly (no silent failure), so this is Low, but the app's main advantage over the website, working without a connection, is missing where it matters most. | Keep the last good `CampusResponse` on the device and show it offline with "Last updated <date>" and the draft badges. It holds only public catalogue records and a university id, nothing personal. Tie the cache to the session so sign-out and account deletion clear it, and drop it when the record's `verifiedOn`/release changes. At minimum, show the national helplines (bundled in content) on the offline state. | Jest: load My campus once, then answer `GET /api/campus` with a network error and expect the security number and "Last updated". Fails today. |
| A7-18 | Low | iOS | `apps/native/components/campus.tsx:126-131` (`OutLink url={p.mapsUrl}`); `packages/catalogue/src/basics.ts:62-75` (`mapsLink` always builds `https://www.google.com/maps/search/?api=1&query=…`) | Owner's decision 2 says "link out to the **phone's** maps app". On an iPhone without Google Maps, which is common, the link opens Google Maps' website in Safari, not Apple Maps. `basics.ts:64-66` documents this. | The full Google Maps website costs much more data than a native maps hand-off on a data bundle, and it reads as a web page. Android is fine (the link opens the Maps app). | In the app on iOS, open `https://maps.apple.com/?q=<query>` or `?ll=<lat>,<lng>&q=<name>`, built from the same `MapLocation`. That means the artifact carries the location as well as `mapsUrl`, or a `mapsLinks()` that returns both. Keep the Google URL on Android, the web and in messages. | Jest with `Platform.OS = 'ios'`: pressing "Open in maps" calls `Linking.openURL` with a `maps.apple.com` URL. Fails today. |

Cross-references (not counted here; already reported in this Phase 5 round):

- **A1-33 (Info): no offer-letter upload in the app.** `apps/native/app/offers.tsx:27` still says
  "Reading a letter by camera is Phase 5d"; `lib/upload.ts:90` knows only `proof-of-registration`,
  and the app's "I got an offer" form always posts `conditions: []` (`offers.tsx:122`). An extra
  native-side detail for whoever closes A1-33: the chat tells every learner, in the app too, to
  "Add the offer under My offers, **or upload the letter**" (`packages/content/src/en.ts:1316`), a
  path the app doesn't have. The card then honestly says "No conditions recorded".
- **A11-13 (High):** the in-app AI disclosure and agreement name only reports and chat. This is
  also the App Store 5.1.2(i) basis for adults, so it blocks submission as well as being POPIA.
- **A11-15 (Medium):** `docs/store/privacy-and-data-safety.md` not updated for Phase 5 (no commit
  touched `docs/store/` in this diff).
- **A3-15, A3-16:** native section titles without a header role, and the university chooser's
  reload with no announcement or focus move. Accessibility belongs to A3. They are not repeated
  here.

---

## 3. Project-specific checks

| Check | Result |
|---|---|
| New screens reachable from Home, notifications and chat | Pass. Home buttons (`app/index.tsx:62-69`), notification routes, and chat artifacts with an "Open" link (`my-modules-card.tsx:315-321`, first-week step links `campus.tsx:153-156`) |
| New screens behind the auth gate | **Fail for `campus` and `first-week`** (A7-13). Pass for `offers`, `modules` |
| Push routes for the new templates | Pass. `APP_SCREENS` gained `offers`, `campus`, `first-week`, `modules` (`messages.ts:69-77`); `ROUTES` is a `Record<AppScreen, AppRoute>` (`push.ts:246-255`), so TypeScript refuses a missing screen; still only from the fixed list, only signed in, only the default action. `offer.reply-by` → `/offers`, `safety.offer-accepted` → `/campus`, `safety.move-in` → `/first-week`, `registration.change-deadline` → `/modules`. Push bodies carry no university, programme, module or date (A11-02) |
| Deep links to the new screens | Routed through `+native-intent.tsx` (A8-02 protection still applies). Signed-out links reach `campus`/`first-week` (A7-13). Device registration of the scheme: Not measured |
| Camera, gallery and PDF upload of proofs | Pass. Permission only on "Take a photo"; system photo picker (no library permission); HEIC → JPEG; EXIF off; type and size checked before upload; fixed file name `registration.<ext>` (hard rule 4); cached copy deleted in `finally`, gallery original untouched (`upload.ts:102-161, 214-226`); denied camera → `en.documents.cameraDenied` with the other two routes still offered |
| Camera upload of offer letters | Not built in the app (A1-33) |
| Hard rule 6 on native (proof of registration) | Pass. Every drafted row shown, editable, removable; draft warnings shown; sample-reader notice; invalid codes block Confirm with the row's error; programme chosen by the learner (defaults to the accepted offer, never to the letter's fuzzy match); nothing sent before Confirm (`confirm-modules.tsx:86-114`). One request at a time (`modules.tsx:65-84`, A3-01 pattern) |
| "No verdict without a curriculum record" in the app | Pass. `MyModulesCard` shows a verdict only when `status === 'checked' && curriculum`; otherwise the content's `noCurriculum`/`noProgramme`/`notFirstYear` |
| "Provisional never shown as accepted" in the app | Pass. Kind and status come from `en.offers.kinds`/`statuses`; only `final` gets the success tone (`offer-card.tsx:16-21`); conditions shown as quoted, in order |
| Drafts labelled | Pass. Programme, campus, place, calendar, faculty office and registration draft badges |
| Offline and error states, retry | Pass on every new screen: load failure → `Notice` + "Try again" (`offers.tsx:91-96`, `campus.tsx:44-49`, `first-week.tsx:66-71`, `modules.tsx:122-127`); action failures keep the data and show the reason (`errorMessage`, with offer `state` reasons from content, `api.ts:139-145`). Gaps: A7-17 (safety numbers offline), A7-13 (401 dead end) |
| Keyboard on the confirm forms | `Screen` keeps A7-06's `automaticallyAdjustKeyboardInsets` + `keyboardShouldPersistTaps="handled"`; credits use `number-pad`. Gaps: A7-15. Device check: Not measured |
| Touch targets | Pass by code: `CallButton`, `OutLink`, `ContactLink` all `minHeight: theme.target`; buttons and radios from `ui.tsx` |
| Tokens and content (rules 8, 9) | Pass. No raw values (`pnpm check` `no-raw-design-values`); every string from `en`; nothing animates in the new components |
| Hard rule 11 (shared packages) | Pass. `pnpm check` `no-dom-in-shared-packages` green; manual grep of the changed `admissions`, `catalogue`, `content`, `ui` sources clean. `ui` gained a `content` dependency, as **types only** (`artifacts.ts:28`, `import type`). The app imports only `@universityflow/catalogue/client` (no zod, no records), never the catalogue's main entry |
| New native dependencies or permissions | None. `apps/native/package.json` and `app.config.ts` permissions unchanged; `Share` and `Linking` are React Native core; no rebuild-only native module added |
| Store documents | Stale (A11-15); purpose strings stale (A7-14); review notes say nothing about Phase 5 (Info, no finding) |
| Version pins | Unchanged: React 19.2.3, RN 0.86.2, Jest 29, jest-expo 57.0.4 |

## 4. Device matrix results

Not run. No physical device or simulator exists for this audit. Code review and Jest probes only.

## 5. Not measured

| Check | Why |
|---|---|
| Every new screen on iOS and Android: layout at 320 pt / 360 dp, safe areas, Dynamic Type at 200% | No device |
| Keyboard over the lower rows of Confirm modules (up to 40 module cards) and the offer form, on an iPhone SE | No device. On Android under SDK 57's edge-to-edge, whether `adjustResize` still lifts the content is also unverified |
| `toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg' })` output under Hermes on both platforms | Probe ran under Node's ICU; Hermes' Intl depends on the platform |
| `tel:` (with `dialable` numbers), `mailto:` and the Google Maps link opening the right app | No device |
| Share sheet with the suggested message (Copy present on both platforms) | No device |
| Camera / gallery / PDF of a real proof of registration, multi-page PDFs, HEIC on Android, deletion of the cached copy | No device; Jest stand-ins only |
| Push delivery and tap-through for the four new templates, cold start and warm | No APNs/FCM credentials, no device |
| Deep links (`universityflow://campus` etc.) registered on both platforms | No device |
| Cold start, scroll FPS on the long campus tour and modules lists (`.map()` inside the `ScrollView`, not a virtualised list) | No device. The longest list is about 40 modules or one university's places, probably fine, but not measured |
| `expo-doctor`, EAS builds, bundle size | Not in this audit's allowed commands (no builds; other auditors share the machine) |
| App Store / Play console forms as filed | Owner items; not filed yet |

## 6. Waived

None.

## 7. Remediation roadmap

- **Quick wins (< 1 day):** A7-13 (two `Stack.Screen` lines + the route-coverage test), A7-14
  (two strings + test, then a native rebuild), A7-16, A7-15 (`autoCorrect`/`spellCheck` on
  `Field`; a numeric keyboard for the date).
- **Medium:** A7-17 (a last-good cache for My campus, cleared with the session); A7-18 (an iOS maps
  link from the same `MapLocation`); a native date picker for A7-15.
- **Before the first store submission, with A11:** A11-13 (disclosure and agreement wording,
  version bump, data-layer check) and A11-15 (store answers), then re-run A7 §7.

## 8. What's genuinely good

- **One code path with the web.** Every new screen calls the same `/api/*` routes as the web pages,
  so admission facts, registration verdicts, deadlines and reminders are decided once, on the
  server, by `packages/admissions` and `packages/catalogue` (hard rule 2). The app only lays them
  out, and says so in each component's header comment.
- **Hard rule 6 for proofs of registration,** done to the same standard as 4d's report flow:
  every row editable and removable, warnings from the reader shown, the programme chosen by the
  learner rather than taken from the document, and an in-flight guard so a double tap can't save
  twice.
- **Upload privacy carried over:** a fixed file name per kind (`FILE_NAMES`, `upload.ts:102-106`),
  EXIF off, the app's copy deleted in `finally`, the gallery never touched, and the student number
  never stored (stated to the learner in `modules.uploadLead`).
- **Notification safety unchanged:** the four new templates open only their own screen through a
  typed map, carry nothing personal, and safety tips go by push only (owner's decision 4).
- **Honest empty and unknown states:** "No conditions recorded", "Not checked yet" for an
  uncatalogued campus, a safety-not-checked line when no health-and-safety place exists, "no
  verdict without a curriculum", and the daysLeft / passed states for reply-by and change deadlines.
- **Safety numbers one tap away:** every campus security, clinic and faculty-office number is a
  44 pt call button with the place in its accessible name. The crisis card gains the learner's own
  verified campus lines only when the server supplies them.
- **No new native surface:** no new dependency, permission or native module. The share sheet
  replaces a clipboard library, which keeps the Phase 4 permission and dependency audit valid.
- **Rule 11 holds and is guarded:** the shared packages Phase 5 grew by thousands of lines are
  still React-Native-safe, and the guard proves it on every `pnpm check`.
