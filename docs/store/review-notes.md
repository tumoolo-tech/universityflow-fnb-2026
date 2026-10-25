# Review notes, and how reviewers sign in

## The problem

Apple and Google reviewers must be able to use the app, and both ask for working sign-in details
("Sign-in required" in App Store Connect; "App access" in Play Console). UniversityFlow signs in
only with a PIN sent by SMS to a South African number. A reviewer in Cupertino or Dublin has no
such number, and an SMS provider is not connected yet. Without a way in, the review is rejected
(App Store guideline 2.1, "App Completeness").

## Decision

Phase 4d documented the options below and built none: a review sign-in is a way into production
that skips the SMS, a **backdoor by design**, in the part of the system audit A1 guards most
closely. On 2026-10-14 the owner chose **option A**, and it is now **built** (audit finding
A7-01), with a test that fails without each guard (hard rule 10). It still needs **an A1 review
before the first submission**.

## The options

### A. A review account with a fixed PIN, in production, fenced in (chosen, built)

One account, created for review, signs in with a fixed PIN that never comes by SMS. The guards,
each enforced in code and tested:

1. **Off unless configured.** Three variables, all required: `UF_REVIEW_PHONE`,
   `UF_REVIEW_PIN_HASH` (the PIN stored only as a hash, like every PIN) and `UF_REVIEW_UNTIL`.
   None set, the code path does not exist; one or two without the others refuses to start.
2. **Only one number, and not a person's.** The number is one the owner controls (a company SIM
   kept for this) so it can never be a learner's number. Sign-in for that number refuses SMS
   entirely: requesting a PIN for it sends nothing and costs nothing. If the configured number
   turns out to belong to a learner (a typo), that learner still gets their SMS PIN, and the log
   says `store-review misconfigured`.
3. **Only a synthetic account.** The account is flagged `review` in the database at creation;
   it is an adult (no guardian flow), cannot request guardian consent to any number, cannot
   opt in to SMS or WhatsApp, and holds only the synthetic marks seeded for review. Push
   notifications work (the reviewer may test them).
4. **Expires.** `UF_REVIEW_UNTIL` (a date): after it, the fixed PIN is refused, and every
   session on the review account stops working too (a review session never outlives the window).
   Set it for the review window of each submission.
5. **Limited and visible.** The same limits as every sign-in: one PIN request a minute and three
   in fifteen minutes for the number, and five tries per PIN request. On top of that, the fixed PIN
   has a budget for the whole window: after **ten wrong PINs**, across all requests and server
   restarts, the review sign-in is refused, even with the right PIN, until the owner sets a new
   PIN hash (or a new date) and redeploys. Every wrong review PIN and every review sign-in is
   logged, and every sign-in writes an audit row, so an unexpected one is seen.
6. **Never a stand-in.** This is not `UF_PROVIDERS=local`; production still refuses every
   stand-in.

Risk that remains: anyone who learns the number and PIN can open the synthetic review account
until it expires. Nothing real is behind it, and it is watched.

#### How it is built

| Guard | Where it is enforced | The test that fails without it |
|---|---|---|
| 1. Off unless configured | `readReview` in `apps/web/lib/server/config.ts`: none of the three variables set means no review sign-in; one or two without the others, or a malformed value, **refuses to start**. The store validates again (`validReview`) | `apps/web/test/config.test.ts` "the store-review sign-in"; `packages/db/src/review.test.ts` "guard 1" |
| 2. One number, nothing sent | `Store.requestOtp` gives the review number a challenge holding the configured hash and no PIN; `/api/auth/request-pin` then sends nothing (no SMS, no budget spent) and answers exactly as for any number, including **503 when the SMS budget is spent** (it checks the budget without spending it). If an ordinary account holds the number, it is an ordinary number (SMS PIN) and the log says `store-review misconfigured`. The fixed PIN opens no other number | `review.test.ts` "guard 2"; `apps/web/test/api-review.test.ts` (a one-SMS budget is still there for the next learner); `api-review-budget.test.ts`; `review-a1.test.ts` "A1-20" |
| 3. Synthetic account only | Migration 0010: `students.review`; a review account must be an adult (`students_review_adult`); triggers refuse a guardian request and any SMS or WhatsApp opt-in for it. `Store.verifyOtp`: the fixed PIN opens only an account flagged `review`, and never creates one. The messaging page offers it push only | `review.test.ts` "guard 3" (the database refuses, not only the store); `api-review.test.ts` "offers the review account push only" |
| 4. Expires | `UF_REVIEW_UNTIL` is **required** (the sign-in always ends), at most 31 days away. After it, a review challenge is refused, even one asked for in time, and the number is an ordinary one again. A review session ends at the window's end at the latest, and `sessionStudent` refuses any session on the review account while no window for its number is open | `review.test.ts` "guard 4"; `review-a1.test.ts` "A1-18"; `config.test.ts` |
| 5. Limited and visible | The same challenge, attempt counter and limits as every sign-in (five tries per PIN request; one request a minute, three in fifteen). Ten wrong review PINs in the window, counted in the database (`rate_events`, keyed by number, PIN hash and date), refuse the review sign-in until a new PIN hash or date. Each wrong one logs `store-review wrong PIN: n of 10`, the lock logs `store-review locked`. Every sign-in to the review account writes the audit row `auth.review-signed-in` and logs `store-review sign-in: student <id>` | `review.test.ts` "guard 5"; `review-a1.test.ts` "A1-19"; `api-review.test.ts` (the lines, IDs only) |
| 6. Never a stand-in | The review configuration is read and used the same in live and local mode; production still refuses `UF_PROVIDERS=local` | `apps/web/test/services.test.ts` "guard 6"; `config.test.ts` |

The PIN is compared in constant time (`sameHash`, `timingSafeEqual`), by the same code that
checks every PIN. The alert: there is no alerting provider yet, so it goes where the SMS budget's
alerts go, a warning line in the server log (Vercel's logs), with the account id only. When the
owner connects alerting (Sentry, D8), point it at every line starting `store-review`.

The review account's marks are synthetic and typed by the seed (`REVIEW_MARKS` in
`packages/db/src/store.ts`), read from no document. Hard rule 6 holds explicitly: they are saved
as a confirmed report, and the audit log records `report.confirmed` by `staff` with the reason
`review-seed`, so it says who confirmed them. The account's date of birth is `2000-01-01`.

#### Owner steps, for each submission

1. **A number.** Get a company SIM kept only for this (never a person's number), and keep it.
2. **A PIN, as a hash.** Choose six random digits (not a pattern: the window allows ten wrong
   guesses). Hash them the way the store does, with the production `AUTH_SECRET` (Vercel →
   Settings → Environment Variables). The PIN and the secret are typed at hidden prompts and
   passed in the environment, never on the command line, so they don't show in `ps` or your
   shell history (bash or zsh):

   ```bash
   read -rsp 'PIN: ' UF_PIN; echo; read -rsp 'AUTH_SECRET: ' AUTH_SECRET; echo; export UF_PIN AUTH_SECRET UF_NUMBER=+27XXXXXXXXX
   node -e "const e=process.env;console.log(require('node:crypto').createHmac('sha256',e.AUTH_SECRET).update(e.UF_NUMBER+':'+e.UF_PIN).digest('hex'))"
   unset UF_PIN AUTH_SECRET
   ```

   Write the number as `+27…` (no spaces). If `AUTH_SECRET` ever changes, make the hash again.
3. **The three variables, in Vercel (Production) only for the review window:** `UF_REVIEW_PHONE`
   (the SIM's number), `UF_REVIEW_PIN_HASH` (the hash), `UF_REVIEW_UNTIL` (the last day,
   `YYYY-MM-DD`, at most 31 days away; to the end of that day, South African time). The hash
   depends on the `AUTH_SECRET` already there. Redeploy.
4. **Seed the account** once, against the production database, **after the deploy and from the
   deployed commit**. The seed never migrates: it refuses, changing nothing, unless the database
   has exactly the migrations of the checkout you run it from.

   ```bash
   DATABASE_URL=… AUTH_SECRET=… UF_REVIEW_PHONE=+27XXXXXXXXX pnpm --filter @universityflow/db review:seed
   ```

   It prints the account's id. Running it again changes nothing; run it again if a reviewer
   deletes the account. It refuses a number that already belongs to an ordinary account, and
   says why: usually someone signed in to the SIM by SMS outside a window (often after a reviewer
   deleted the review account). Sign in to that number by SMS, delete that account (About me →
   Delete my account), and seed again.
5. **Give the reviewers** the number, the PIN and the date (the notes below).
   Optional (owner's call, A7-11): the notes send reviewers down "Type my marks in instead",
   because a reviewer has no school report. To let them see the AI read one, make a synthetic
   report image, watermarked **SAMPLE** across the page, with made-up marks and no real school,
   learner or ID number; host it at a public URL; and add to step 2 of the notes "or open
   (URL) on another screen and photograph it".
6. **After the review**, remove the three `UF_REVIEW_*` variables and redeploy. Sessions on the
   review account already stop at the window's end; delete them too, against the production
   database:

   ```sql
   delete from sessions where student_id in (select id from students where review);
   ```

   Check the logs for `store-review` lines you didn't expect: `wrong PIN`, `locked`,
   `misconfigured`, or a `sign-in` outside the reviewers' hours. **If you see `locked`**,
   someone is guessing: choose a new PIN, set its hash and redeploy (that starts a fresh count).

### B. A separate review deployment

A second, isolated deployment (own database, synthetic data, the SMS stand-in) and a separate
build pointed at it. **Doesn't work for the stores**: reviewers review the build that will be
released, which must point at production. Useful only for TestFlight or internal testing.

### C. A real SMS number for the reviewers

Give the reviewers a phone number whose SMS the owner receives, and relay the PIN during review.
Not workable: review times are unpredictable (often night in South Africa), and the PIN expires
in ten minutes.

### D. A demo mode with no account

Let the app run without signing in, on sample data. Changes the product (the app is built around
a learner's own marks and consent), adds a second path through every screen, and still leaves
the real sign-in unreviewed. Not recommended.

**Owner decision (2026-10-14): A**, now built. Until A1 has reviewed it, the app can be submitted
only for **TestFlight internal testing** and Play's **internal testing** track, neither of which
needs a review sign-in.

## Notes for the reviewers (paste into each store)

> UniversityFlow helps South African high-school learners (Grade 10 to 12) see which university
> courses their marks qualify them for, plan applications, and get study reminders. Sign-in is
> by a PIN sent by SMS to a South African number. For review, please use:
>
> Phone: (the review number)  PIN: (the review PIN)  — valid until (date)
>
> Enter the phone number and tap to get a PIN; no SMS is sent for this number, so enter the PIN
> above. The review account is an adult learner with sample marks already confirmed. After
> signing in, the app explains what it does with a learner's information, including that chats
> and report photos go to its AI provider, and asks the learner to agree: tap the agree button.
> To see the full flow:
> 1. **My results**: courses grouped as "Qualify now", "Close" and "Plan B". Data marked "Not
>    yet verified" is labelled as such. Under them, **My school record** shows every report the
>    learner confirmed side by side, with each mark's achievement level; it is worked out from
>    the confirmed marks and collects nothing new.
> 2. **Upload my report**: a learner photographs their school report, and the app reads the
>    marks into a draft that must be checked row by row before anything uses it. You won't have
>    a South African school report, so the simplest path is **"Type my marks in instead"**: tap
>    "Add a subject", choose a subject, type a percentage, and tap "These marks are correct";
>    My results then shows courses for the marks you typed. To see the camera step too, tap
>    "Take a photo" (the camera is asked for only then) and photograph any printed page: the app
>    says it couldn't read a report there and lets you type the marks instead. The photo is
>    deleted from the phone after upload.
> 3. **Notifications**: tap "Turn on notifications"; the system asks then, never at launch.
>    Notifications never show a name or marks. (SMS and WhatsApp reminders are switched off for
>    the review account: its number is not a person's.)
> 4. **Chat**: ask "What can I study with my marks?". If someone writes about self-harm or
>    abuse, the app answers with South African helplines before any AI is involved.
> 5. **About me → Delete my account** deletes the account and everything in it. (If you delete
>    the review account, the PIN stops working until we restore it: please do this last.)
>
> Learners under 18 need a parent or guardian's consent before the app processes their data
> (South Africa's POPIA); the review account is an adult so that step is skipped.
>
> The app uses encryption only for HTTPS (exempt). It has no ads, no tracking and no in-app
> purchases.

## What reviewers will and won't see (refreshed 2026-10-23, after #83 and #85)

The store build talks only to production (`EXPO_PUBLIC_UF_API_URL` in the `production` EAS
environment, `https://` or the build refuses, A7-05). What a reviewer sees is decided by that
server's switches, so this is what production shows today, and what changes if a switch is
turned on.

| Screen | What the reviewer sees | What the store forms must declare |
|---|---|---|
| **My school record** (C2, #83), on My results | The review account's seeded report as one column; each report the reviewer confirms (typed marks are fine) adds a column, labelled "Entered by you". Worked out on the server by `packages/admissions` from marks already confirmed | Nothing new: the marks are already declared ("Other user content", Apple; "App activity: other user-generated content", Google) |
| **The profile photo** (`UF_PROFILE_PHOTO`) | Nothing: production refuses the switch (`apps/web/lib/server/config.ts`), so About me offers no photo buttons and keeps the drawn avatar | Nothing today. **Before it is ever on:** the camera and photos purpose strings (`en.permissions`, mirrored in `app.config.ts`) now also name the profile photo ("…or of yourself, if you add a profile photo", A7-23, 2026-10-24), pending the owner's wording review; they reach a phone only in **a new app build**; the forms then declare it as privacy-and-data-safety.md already lists it (Photos, App Functionality, not shared) |
| **The profile look** (theme, avatar, tagline, words) | Shown: About me → Make it yours. Ids from fixed lists, never free text | Already declared (privacy-and-data-safety.md, "The profile look") |
| **My plan maps** | Shown, ticks only: the reflections in the learner's words wait for consent wording that names them (`UF_MINDMAP_WORDS`, refused in production) | Already declared ("Plan maps and reflections") |
| **My CV** (#85, `UF_CV`) | **Nothing.** Production refuses `UF_CV` until consent v4 / adult-v3 name Mmereko, so every CV route answers 404, About me shows no My CV link, and the screen (reachable only by typing its deep link) says My CV isn't available | Nothing today. **When it is on** (after the legal review, the Tumoolo–Mmereko agreement and Mmereko's South African cell): Email address (typed for the CV), Files and docs (the CV PDF), Mmereko as a processor, and the recruiter links for adults (a public link to the learner's own CV, which they create and can revoke): privacy-and-data-safety.md, "When My CV is switched on". Tell the reviewers where it is and that sharing is for 18+ only; the review account is an adult, so they would see "Share with a recruiter" |
| **"Sample" notices** (a draft read by the sample reader) | Nothing: they appear only with the local stand-in reader, and production refuses every stand-in | — |

**The judge demo must never reach a store build.** Everything made for the FNB hackathon lives in
the web app's demo deployment (`UF_DEPLOYMENT=demo`, docs/deploy/demo.md) and none of it is in the
app: the six synthetic personas, the drawn sample photos (never a real upload), the university
logos (`NEXT_PUBLIC_UF_DEMO_LOGOS`, shown with no licence: a hackathon exception), the judges'
Firebase sign-up and the "Demo for judges" button. Before each store build, check:

- [ ] `EXPO_PUBLIC_UF_API_URL` in the **production** EAS environment is the production server,
      **not** the demo (`universityflow.vercel.app` or any `*-demo` address). The demo has no
      phone sign-in, so a build pointed at it can't sign the reviewers in.
- [ ] No store screenshot or listing image shows a university's logo (the app draws the neutral
      mark: `logoPermission`), a demo persona, a demo sample photo, or a real learner.
- [ ] After the hackathon, the exceptions are undone (docs/deploy/demo.md, "Hackathon exceptions").

## Other things reviewers check, and where they stand

| Check | Status |
|---|---|
| Account deletion inside the app (Apple 5.1.1(v)) | ✅ About me → Delete my account (`apps/native/app/account.tsx`), and from the guardian and waiting steps of onboarding, so a minor without consent can delete too |
| Permission prompts explain their use (Apple 5.1.1) | ✅ Camera and photos in plain words (`en.permissions`); notifications explained on screen before the system asks |
| Permission asked in context, not at launch | ✅ Tested in Jest (`__tests__/push.test.tsx`, `upload.test.tsx`); confirm on a phone |
| Privacy policy URL | ⬜ Owner: publish it ([release-checklist.md](release-checklist.md) §1) |
| Export compliance | ✅ `ITSAppUsesNonExemptEncryption: false` |
| No placeholder content | ⬜ Owner: replace the placeholder icons and splash |
| No demo content in the build or the listing | ✅ The app has none (the demo is the web's); ⬜ owner: the checks above, each submission |
| Works on a small phone and with large text | ✅ Jest: the screens added since #81 (school record, photo and look, plan maps, My CV) at 320 and 360 dp, no fixed width past the edge, words that wrap, 44-point controls with a role and a name (`apps/native/__tests__/small-screens.test.tsx`); ⬜ confirm on a phone (android-dev-build.md, step 13) |
| Works on IPv6-only networks (Apple) | Expected (HTTPS to a host name, no IP literals); confirm in review |
