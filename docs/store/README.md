# The app in the stores (Phase 4d)

Everything the owner needs to put the UniversityFlow app in the App Store and on Google Play.
The code side is done and tested; what is left needs the owner's accounts (D8, Q18).

| Document | What it is for |
|---|---|
| [android-dev-build.md](android-dev-build.md) | **Start here:** the app on your own Android phone, a development build step by step on Windows (EAS project, variables, build, install, the sign-in PIN, what to test first, reporting a crash) |
| [release-checklist.md](release-checklist.md) | Step by step, from accounts to "Submit for review", for each release |
| [privacy-and-data-safety.md](privacy-and-data-safety.md) | The answers for Apple's App Privacy ("nutrition label") and Google Play's Data safety form, derived from what the app and its server actually collect |
| [review-notes.md](review-notes.md) | What to tell the reviewers, and how they sign in without a real SMS (an owner decision) |

The app's configuration lives in `apps/native/app.config.ts` and `apps/native/eas.json`; both
are tested (`apps/native/__tests__/app-config.test.ts`). The icons are placeholders until the
owner's artwork arrives (`apps/native/assets/README.md`).

**Budget review time inside Phase 4** (planning.md §11): Apple's first review can take several
days and can reject; Google's first review of a new developer account can take a week or more.
Submit the first build well before June 2027.
