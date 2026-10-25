# PHASE-4 — A7 Mobile and native

**Project:** UniversityFlow · **Phase:** 4 (first store release) · **Date:** 2026-10-14
**Commit:** 7d53bc6 (branch `phase-4/audits`) · **Audit source:** tumoOLO_Audits @ 29eafd7
**Result:** 0 Critical · 4 High · 2 Medium · 6 Low · 0 waived · 14 not measured

Scope: `apps/native` whole (A7 has never run before), with emphasis on Phase 4d (#33): Expo push,
camera/gallery/PDF upload with confirm-before-use, in-app account deletion, `app.config.ts`,
`eas.json`, icons, `docs/store/`, secure storage of the session, release `http` refusal, offline
behaviour, permission strings and store review risks. Code and resolved config only: no device,
simulator, EAS build or `expo-doctor` run (see Not measured).

Evidence run for this audit:

- `pnpm --filter @universityflow/native test`: **16 suites, 115 tests, all pass**.
- `pnpm --filter @universityflow/native typecheck`: clean.
- `npx expo config --type introspect --json` with `EAS_BUILD_PROFILE=production`: resolved
  Info.plist, entitlements and AndroidManifest (quoted below).
- A throwaway Jest probe (`__tests__/a7.audit-tmp.test.tsx`, deleted afterwards) proved A7-02,
  A7-03 and A7-05 against the real app code: all three probes passed, i.e. the defects are real.

---

## 1. Executive summary

The app is a careful, well-tested thin client: the session sits in the Keychain/Keystore with
`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, nothing is logged, cookies are never sent (gotcha 26), a
release build refuses a non-https API URL, permissions are asked only in context, report photos
are deleted from the app's cache after upload, every read mark goes through the confirm screen
(hard rule 6), and notification taps can only open a fixed list of screens. The store documents
are unusually honest. What stops a store release today is four things: **reviewers cannot sign
in** (no review account exists), **push notifications silently stop for every learner after the
30-day session expires** while the app keeps saying "on", **a learner on the date-of-birth or
adult-consent step can neither sign out nor delete their account**, and **an adult learner is
never told in the app, or asked, before their chats and report photos go to the AI provider**
(App Store guideline 5.1.2(i)).

Top 5 risks:

1. A7-01: App Review rejection under 2.1 (no reviewer sign-in); the phase cannot ship to the stores.
2. A7-02: deadline reminders stop reaching every learner 30 days after sign-in; the app says they are on.
3. A7-04: rejection under 5.1.2(i), third-party AI sharing without in-app disclosure and permission for adults.
4. A7-03: learners stuck in onboarding cannot sign out (shared phones) or delete (5.1.1(v)).
5. A7-05: a mis-set production API URL presents as "You're offline" on every screen, including to a reviewer.

### Native-feel verdict: **acceptable**

Native: system pickers, the camera, the native stack with its back gesture, safe areas, SMS
one-time-code autofill, correct keyboard types. What makes it read closest to a web wrapper:

1. Screen transitions are switched off for everyone (`animation: 'none'`, A7-12), so every push
   is an instant cut, like a page load.
2. Home is a vertical stack of eight full-width buttons rather than a tab bar or native list.
3. Form screens have no keyboard handling on iOS (A7-06).

### Store-readiness verdict: **would not pass review today**

- **2.1 App Completeness**: no review sign-in (A7-01). Certain rejection for App Store and a Play
  "App access" failure.
- **5.1.2(i)** (third-party AI disclosure and permission): adults are not told or asked (A7-04).
- **5.1.1(v)** account deletion: present from Home and from the guardian/waiting steps, but not
  from the date-of-birth or adult-consent steps (A7-03). A reviewer using a pre-seeded adult
  account would not hit it; a real learner does.
- **Placeholder artwork**: the icons in `apps/native/assets/` are placeholders (documented; the
  release checklist forbids shipping them). Owner item, not a code finding.
- **4.2 Minimum Functionality**: low risk. Camera capture of a report, confirm-before-use,
  push reminders and in-app deletion are genuinely native features beyond the website.

---

## 2. Findings

| ID | Severity | Platform | Location | Finding | Why it matters | Fix |
|---|---|---|---|---|---|---|
| A7-01 | High | both | `docs/store/review-notes.md:11-18`, `:65-67` | No way for an App Store or Play reviewer to sign in. Sign-in is SMS-PIN to a South African number only; the review account (option A) is designed but not built, and the owner has not chosen an option. | Guideline 2.1 rejection (and Play "App access" failure) is certain. Phase 4's deliverable is the first store release, and only TestFlight/Play internal testing is possible until this exists. It cannot be waived as an owner decision because the owner has not decided. | Owner chooses (A is sound). Build option A with every guard in code (env-gated, one non-person number, SMS refused for it, `review`-flagged synthetic adult account, `UF_REVIEW_UNTIL` expiry, attempt limit, audit row + alert), each with a failing-without-it test (hard rule 10), and have A1 review it before first submission. |
| A7-02 | High | both | `apps/native/lib/push.ts:115-130`; `apps/native/app/notifications.tsx:21-25`; `apps/native/lib/api.ts:71-74`; server: `packages/db/src/messaging.ts:166-167`, `packages/db/src/store.ts:78`, `:407` | Push silently stops after the session ends, and the app still says "On". The server sends only to tokens whose **session** is unexpired; sessions last a fixed 30 days. When a 401 clears the session (`api.ts:73`) the saved `uf.push-token` is left behind; after the learner signs in again, Notifications shows `en.notifications.on` (account opted in + a saved token) and the app never re-registers the token for the new session. Nothing re-registers on launch or on Expo token rotation either (`addPushTokenListener` unused). Probe proved: after a 401 and a fresh sign-in, the screen shows "On" with only `GET /api/me/messaging` called. | Every learner who turned notifications on stops getting deadline and exam reminders 30 days later, with the app telling them they are on. A defect certain to cause incidents. | On every signed-in launch (and on sign-in), if the account has push opted in and permission is granted, get the Expo token and `POST /api/me/push-token` (idempotent; it moves the token to this session). Forget `uf.push-token` in `clearToken()` / on 401 too. Subscribe to `Notifications.addPushTokenListener` and re-register. Show "On" only after a successful registration this session. |
| A7-03 | High | both | `apps/native/components/onboarding.tsx:62-77` (date of birth), `:135-154` (adult consent), `:81-133` (guardian/waiting) | During onboarding there is no sign-out anywhere, and no delete on the date-of-birth or adult-consent steps. An adult asked for their own consent has no "I don't agree", no delete, no sign-out. Probe proved neither button exists on the DOB and adult steps. | A learner cannot complete a task: leave a shared phone (common in the target group) or delete an account that already holds their phone number (POPIA; App Store 5.1.1(v) requires deletion to be reachable once an account exists). The adult-consent step is a dead end. | Add `Sign out` to every onboarding step, and `Delete my account` to the DOB and adult steps (as the guardian and waiting steps already have), plus a decline path on the adult step. |
| A7-04 | High | both | `packages/db/src/store.ts:477` (an adult goes straight to `not-required`); `apps/native/components/onboarding.tsx:19-26`; `packages/content/src/en.ts:159` (the only AI-provider wording, on the guardian page); `apps/native/app/chat.tsx`, `apps/native/app/upload.tsx:107` | An 18+ learner signs in, gives a date of birth and is in the app, with chats and report photos sent to the AI provider outside South Africa, without the app ever disclosing that or asking permission. The disclosure exists only on the guardian consent page, which adults never see. The review account is an adult, so a reviewer walks exactly this path. | App Store guideline 5.1.2(i) requires clear disclosure of personal data shared with third parties, **including third-party AI**, and explicit permission first. Likely rejection, and the same gap is a POPIA transparency issue for adults (A11's territory: cross-reference). | Show adults a consent step after the date of birth with the `whatWeKeep` wording (AI provider, outside South Africa, not used for training) and an explicit agree, recorded server-side before chat or upload is allowed; or, at minimum, a just-in-time disclosure + agree before the first chat message and the first upload. |
| A7-05 | Medium | both | `apps/native/lib/api.ts:51-63`; `apps/native/__tests__/app-config.test.ts:102-103` | `apiUrl()` is called inside the `try` around `fetch`, so a release build with `EXPO_PUBLIC_UF_API_URL` unset or `http://` turns `ConfigError` into `ApiError(0, 'network')` and shows "You're offline" on every screen. The config test's comment ("a wrong value fails loudly, not silently") is not true, and nothing fails the EAS build. Probe proved the offline sentence. | Preview and production read separate EAS environments, so production can be wrong while preview tested fine; the reviewer then sees a permanently offline app (2.1 rejection) and support sees "network" errors. | Resolve the URL outside the `try` (let `ConfigError` surface as a distinct error and message), and fail the build: an `app.config.ts` check that throws when `EAS_BUILD_PROFILE` is `production`/`preview` and the variable is missing or not https. |
| A7-06 | Medium | iOS (Android likely fine with `adjustResize`) | `apps/native/components/ui.tsx:39` | `Screen`'s `ScrollView` has no keyboard handling (no `KeyboardAvoidingView`, no `automaticallyAdjustKeyboardInsets`). On iOS the keyboard covers the lower fields of Confirm marks (7+ percent fields), the guardian phone and the delete-confirm field, and the content cannot scroll them above the keyboard. Chat does it correctly. | Degraded entry on the screen where hard rule 6 happens; workaround is dismissing the keyboard. Device behaviour Not measured. | `automaticallyAdjustKeyboardInsets` on the `ScrollView` (iOS) or wrap `Screen` in `KeyboardAvoidingView behavior="padding"`; verify at 320 pt width with the keyboard up. |
| A7-07 | Low | iOS | resolved Info.plist (`npx expo config --type introspect`): `NSAppTransportSecurity.NSAllowsArbitraryLoads: true`; `apps/native/app.config.ts:69-72` | The production build allows arbitrary cleartext loads. The API is still https-only (`lib/config.ts:34`), so this is defence in depth only, but `docs/store/privacy-and-data-safety.md:76-77` states HTTPS only. Android release refuses http (gotcha 27); iOS does not. | A server-supplied upload URL or any future fetch could go over http without the OS stopping it; Apple asks for justification of arbitrary loads. | Set `ios.infoPlist.NSAppTransportSecurity = { NSAllowsArbitraryLoads: false }` for non-development profiles (keep the localhost exception for dev), and assert it in `app-config.test.ts`. |
| A7-08 | Low | iOS | `apps/native/app.config.ts:111`; resolved `NSFaceIDUsageDescription: "Allow $(PRODUCT_NAME) to access your Face ID biometric data."` | `expo-secure-store` adds its boilerplate Face ID purpose string; the app never uses biometrics, and the string is not from `packages/content` (hard rule 8). | Unused, generic purpose strings are a 5.1.1 review nit and contradict "plain words" in the review notes. | `['expo-secure-store', { faceIDPermission: false }]` and a config test that the resolved plist has no `NSFaceIDUsageDescription`. |
| A7-09 | Low | both | `apps/native/app/account.tsx:30-36` | About me says "You can change it, download it or delete it", but the app offers only delete; after a successful delete the app drops to sign-in with no confirmation (`en.me.deleted` is never shown). | Confusing at an irreversible moment; a learner may think it failed and retry. | App-specific lead (or link to the web page for change/download), and show `en.me.deleted` on the sign-in screen after a deletion. |
| A7-10 | Low | both | `apps/native/app/notifications.tsx:26-28`, `:76-79` | If loading `/api/me/messaging` fails (offline), the screen shows the error and no retry button; the only way out is back. Every other screen has "Try again". | Dead end on a poor network. | Add the `en.common.tryAgain` button as the other screens do. |
| A7-11 | Low | both | `docs/store/review-notes.md:81-82` | The reviewer is told to "choose the sample PDF", but no sample PDF exists on a reviewer's phone, and "a photo of any printed page" will read as "not a report" with the real AI. | A confused reviewer is a slow or failed review. | Attach a synthetic sample report (image/PDF URL in the notes, or pre-uploaded), or say "type the marks" as the path. |
| A7-12 | Low | both | `apps/native/components/gate.tsx:39` | Native stack transitions are disabled for everyone (`animation: 'none'`), not only under Reduce Motion. | Instant cuts read as a web page; hard rule 9 asks for a reduced-motion path, not no motion. | `animation: reduceMotion ? 'none' : 'default'` from `AccessibilityInfo.isReduceMotionEnabled()` / `useReducedMotion`. |

Regression tests each fix needs (hard rule 10 for the Highs):

- **A7-01**: server tests that the review PIN is refused when either variable is unset, after
  `UF_REVIEW_UNTIL`, for any other number, after five wrong attempts, and that requesting a PIN
  for the review number sends no SMS.
- **A7-02**: Jest: save a session and `uf.push-token`, answer `/api/me` with 401, sign in again,
  open Notifications with the account opted in: expect `POST /api/me/push-token` before "On" is
  shown (fails today: only `GET /api/me/messaging` is called). Also: `clearToken()` removes
  `uf.push-token`.
- **A7-03**: Jest: render `Onboarding` with `consentStatus: 'unknown'` and with
  `consentStatus: 'granted', needsAdultConsent: true`; expect buttons named `en.nav.signOut` and
  `en.me.deleteTitle` (fails today).
- **A7-04**: server test that an adult with no recorded AI consent gets 403 from `/api/chat` and
  `/api/documents*`; Jest test that the adult path shows the disclosure and an agree button.

---

## 3. Device matrix results

Not run. No physical device or simulator was used (the brief rules device runs out for this
reviewer). Everything device-shaped is listed below as Not measured.

## 4. Not measured

| Check | Why |
|---|---|
| Cold start, FPS during scroll, memory across navigation | No device run |
| Bundle size per platform, Hermes | No `eas build`/`expo export` run (brief: no builds) |
| `expo-doctor` | Not in the allowed command list (network checks) |
| EAS build from a clean checkout, production profile signing, Play App Signing | No EAS access, no builds |
| Target SDK / compile SDK for Android | Resolved only inside a prebuild/Gradle run, not by `expo config` |
| Icon rendering at every size, adaptive-icon safe zone, splash colour flash | No device; icons are documented placeholders anyway |
| Safe areas on notch/Dynamic Island/gesture bar; 320 pt layouts | No device |
| Dynamic Type / font scale 200%, VoiceOver and TalkBack order | No device (A3 owns the native accessibility pass) |
| Keyboard covering fields (A7-06) | Found by code; confirm on an iPhone SE |
| Push delivery end to end; APNs `aps-environment` for ad-hoc preview builds (config sets `development` unless the profile is `production`) | No APNs/FCM credentials, no device |
| Camera/gallery/PDF on device, HEIC from an Android gallery, deletion of the cached copy | No device (Jest-only coverage) |
| Request timeouts on a slow network (no `AbortSignal`/timeout in `api()` except chat) | Needs a throttled real network; OS defaults decide today |
| Deep links (`universityflow://`) on both platforms | No device |
| Privacy policy URL, support URL live; screenshots | Owner items, not published yet |

## 5. Waived

None.

## 6. Remediation roadmap

- **Quick wins (< 1 day):** A7-03 (buttons on two steps), A7-05, A7-07, A7-08, A7-09, A7-10,
  A7-11, A7-12.
- **Medium:** A7-02 (re-register on launch/sign-in, token listener, clear on 401, tests);
  A7-06 (keyboard handling + device check); A7-04 (adult disclosure + consent step, server gate).
- **Structural / owner:** A7-01 (owner decision, then build, test and A1 review of the review
  account) before the first store submission.

## 7. What's genuinely good

- **Session storage** (`lib/session.ts`): secure store only, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`,
  excluded from Android backups by the `expo-secure-store` plugin (resolved manifest shows the
  backup/data-extraction rules), unreadable entry treated as signed out.
- **No cookies, ever** (`credentials: 'omit'` on every request, gotcha 26), `x-uf-client: native`
  header, a 401 anywhere flips the gate to sign-in.
- **Release refuses http** (`lib/config.ts:34`, tested) and `EXPO_PUBLIC_UF_API_URL` is read
  literally (gotcha 27); no URL is baked into `eas.json` (tested).
- **Permission discipline**: notifications permission only on "Turn on", after an explanation;
  `canAskAgain: false` is respected; Android channel created first; camera permission only on
  "Take a photo"; the system photo picker needs no media permission. Twelve unneeded Android
  permissions, including `AD_ID` and `RECORD_AUDIO`, are blocked and the block is tested;
  microphone permission explicitly off.
- **Purpose strings** come from `packages/content` and a test keeps `app.config.ts` in step.
- **Upload privacy**: fixed upload file name (no learner name leaks, hard rule 4), EXIF off,
  HEIC converted, the app's cached copy deleted in `finally` while the gallery original is never
  touched, client-side type and size checks mirrored from `packages/documents`.
- **Hard rule 6 in the app**: every drafted mark is shown, editable and removable, duplicates
  and out-of-range values block submission, and nothing is saved until Confirm
  (`components/confirm-marks.tsx`), through the same `/api/reports` as the web.
- **Notification taps** can open only `home`, `results`, `goals` (prototype keys such as
  `toString` rejected, tested), only when signed in, and the cold-start response is consumed once.
- **Account deletion** calls the same `DELETE /api/me` as the web and removes the push token
  and session locally; deletion is also offered to a minor waiting for consent.
- **Store paperwork**: the privacy labels and Data safety answers are conservative and traced to
  the schema; build numbers are remote and auto-incremented; export compliance is declared; the
  privacy manifest declares no tracking.
- **Version pins** respected: React 19.2.3, RN 0.86.2, Jest 29, jest-expo 57.0.4.
