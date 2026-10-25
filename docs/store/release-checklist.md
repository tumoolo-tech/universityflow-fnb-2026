# Release checklist: the app in the App Store and on Google Play

For the owner. Tick each line for every release; the once-only steps are marked **(once)**.
Nothing here can be done by the code: each needs an account, a decision or a device.

## 1. Accounts and services (once)

- [ ] **Apple Developer Program** as an organisation (needs a D-U-N-S number for Tumoolo Tech;
      that can take weeks: start first). Note the Team ID.
- [ ] **Google Play Console** as an organisation. (A *personal* account created after
      November 2023 must run a closed test with at least 12 testers for 14 days before it may
      publish to production; an organisation account need not.)
- [ ] **Expo account** and an EAS project: in `apps/native`, run `npx eas-cli@latest init`.
      `app.config.ts` is dynamic, so EAS prints the project id instead of writing it: set it as
      `UF_EAS_PROJECT_ID` in your shell and in each EAS environment (it is not a secret). Push
      tokens need it, and every EAS build refuses to start without it (A7-21). The first time,
      follow [android-dev-build.md](android-dev-build.md): it ends with the app on your phone.
- [ ] **EAS environment variables** at expo.dev → Project → Environment variables, for
      `development`, `preview` and `production`:
      - `EXPO_PUBLIC_UF_API_URL`: the web app's address. Production must be `https://` (a release
        build refuses anything else, `apps/native/lib/config.ts`), for example the Vercel `cpt1`
        deployment's own domain.
      - `UF_EAS_PROJECT_ID`.
- [ ] **Push credentials**: `eas credentials` creates the iOS push key (APNs) and uploads the
      Android FCM v1 service-account key (create a Firebase project for the Android package
      `tech.tumoolo.universityflow` and download its service account JSON). Without these, Expo
      accepts a push and Apple/Google refuse it (the receipt says so).
- [ ] **Enhanced push security** (A5-03, A11-06): at expo.dev → Project → Settings, turn on
      "Enhanced security for push notifications", then create an access token for the project
      (expo.dev → Account settings → Access tokens; a robot user's token is best). Without it,
      anyone who learns a learner's push token can put any text on a minor's lock screen under
      UniversityFlow's name.
- [ ] **Server**: `UF_PUSH_PROVIDER=expo` and `EXPO_ACCESS_TOKEN` (that token, a secret: set it
      in Vercel, never in a file). The server refuses to start with Expo push and no token.
      The `receipt.check` job runs with the reminders: register `services.jobHandlers` (both
      handlers) with the production job scheduler when it is connected.
- [ ] **A privacy policy URL** on the public site, matching
      [privacy-and-data-safety.md](privacy-and-data-safety.md), naming the Information Officer,
      and saying that app notifications pass through Expo, Apple and Google
      (docs/audits/A11-privacy-popia.md, check 8). Both stores require it.
- [ ] **A support URL or email** for the store listings.

## 2. Before each build

- [ ] `pnpm verify` green on `main` (it builds the iOS and Android bundles too).
- [ ] **Artwork**: replace the placeholder icon, adaptive icon, splash and notification icon in
      `apps/native/assets/` (sizes and rules in its README). **Never ship the placeholders.**
- [ ] **Version**: raise `version` in `apps/native/app.config.ts` (1.0.0 for the first
      release; the store shows it). Build numbers are EAS's (`appVersionSource: remote`,
      `autoIncrement`): don't set them by hand.
- [ ] The catalogue and the exam timetable the production web app serves are **verified**
      (hard rule 3): the app shows only what the server shows.

## 3. Build and test on real phones

- [ ] `eas build --profile preview --platform all` and install on at least one cheap Android
      phone (Android 10–12 *and* 13+) and one iPhone. Things only a phone can prove (the
      tests are Jest-only for these):
  - [ ] sign-in by SMS PIN; onboarding; results; chat
  - [ ] **Notifications**: turning them on shows the system prompt only then; a test reminder
        arrives (dev: `/api/dev/jobs/run`), shows no name or marks on the lock screen, and
        tapping it opens the right screen, with the app closed and with it open; turning them
        off, and signing out, stop them
  - [ ] **Camera upload**: the camera prompt appears only on "Take a photo"; a photo, a gallery
        photo (an iPhone HEIC photo too) and a PDF each upload and show the marks to confirm;
        afterwards the photo is gone from the app's cache (and the gallery photo is untouched)
  - [ ] on Android 10–12, choosing a photo works (the storage permissions there are kept)
  - [ ] delete the account from About me
  - [ ] large text (accessibility font size) and a screen reader (VoiceOver, TalkBack) on the
        new screens
- [ ] `eas build --profile production --platform all`.

## 4. Store listings (once, then on change)

- [ ] **App Store Connect**: create the app (bundle id `tech.tumoolo.universityflow`, primary
      language English (South Africa) or English (U.K.)), category **Education**.
- [ ] **Age rating**: answer the questionnaire honestly. The app has an AI chat, which Apple
      asks about; no violence, gambling, or user-to-user content. **Aim for 13+** (owner's
      choice, G10-6, 2026-10-22): learners start in Grade 10, at about 15 (Grade 9 is refused,
      A1-39), so 16+ would shut most of them out. Confirm with the legal reviewer.
- [ ] **App Privacy**: the answers in [privacy-and-data-safety.md](privacy-and-data-safety.md).
- [ ] **Google Play**: create the app, category **Education**; **Target audience** 13–15,
      16–17 and 18+ (not under 13, so the Families policy does not apply; sign-up refuses a
      date of birth under 13, A11-24); **Data safety** from
      the same document; **Ads**: no; **App access**: the review sign-in from
      [review-notes.md](review-notes.md); content rating questionnaire (IARC).
- [ ] Screenshots from the preview build: iPhone 6.9" (and 6.5"), Android phone. No real
      learner's data in a screenshot: use the review account's synthetic marks.
- [ ] Description and keywords; never promise admission (the charter, planning.md §4.1).

## 5. Submit

- [ ] `eas submit --profile production --platform ios` (asks for the App Store Connect app id the
      first time) and `--platform android` (goes to the **internal** track as a draft:
      promote it in the console).
- [ ] Review notes and the sign-in from [review-notes.md](review-notes.md) in each store.
- [ ] Phased release on iOS; staged rollout on Android (start at 20%).
- [ ] After release: update `status.md` (store versions, review outcome), and watch the push
      receipts (`reminders.delivery_status`) for a rise in `failed`.
