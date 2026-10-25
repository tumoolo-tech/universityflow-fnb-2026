# After the hackathon: the PR that undoes the exceptions (ready to use)

**For:** whoever opens the PR once the FNB hackathon judging has ended (the integrator or an
agent), and the owner, who does the console steps. Written 2026-10-23 from
docs/deploy/demo.md "Hackathon exceptions"; every path below was checked to exist on `main` at
092163c. **Nothing here has been reverted yet.** Re-check the paths when the PR is opened: later
work may have moved them.

**Order matters.** The owner's console steps 1–3 (switch off, delete the accounts) come **first**,
on the day judging ends. The PR follows. The migration in the PR refuses to run while any judge's
account is left, so the order is enforced, not only written down.

---

## Title

```text
revert(web): end the hackathon exceptions: the judges' real sign-up and the universities' logos
```

(One scope per the conventions; if the PR is split, the second is `revert(catalogue): …` for the
logo exception in packages/catalogue.)

## Summary (PR body)

> The owner approved two exceptions for the FNB hackathon judge demo only, on 2026-10-23, with the
> stated intention that safety and the law come first and that both are undone afterwards
> (planning.md §20, docs/deploy/demo.md "Hackathon exceptions"):
>
> 1. **The judges' real sign-up** (`UF_DEMO_SIGNUP=firebase`), approved verbatim: *"approved: build
>    the Firebase real sign-up for the judge demo, 18+ only, accounts deleted after 30 days"*.
>    Real adults' data (a Firebase uid and an email, migration 0034's `demo_signups`) in the demo
>    database, Google Firebase as a sign-in operator, notice wording without legal review, and a
>    CSP widened for Firebase on the sign-up page.
> 2. **The universities' own logos** in the demo (`NEXT_PUBLIC_UF_DEMO_LOGOS=1`), setting aside
>    option A of docs/brand/logo-permissions.md for one deployment, with a "not affiliated" line.
>
> Judging ended on DATE. The owner switched both off and deleted every judge account on DATE
> (console steps below). This PR removes the code, drops the table, and keeps tests that fail if
> either comes back. The six made-up learners, the picker, "Back to UniversityFlow", the sample
> photos, the demo's files in Postgres and the optional AI cap are **not** exceptions and stay.

> Added 2026-10-24: three more exceptions the owner approved that day, for the judge demo only
> (docs/deploy/demo.md "The demo's extra features"): **My CV on the built-in stand-in**
> (`UF_CV=1`, never Mmereko, D14), **plan-map words** (`UF_MINDMAP_WORDS=1`) and **Read aloud**
> (ElevenLabs' key and voice). Their undo is E, F and G below, and console step 7.

## The owner's console steps (before the PR merges)

1. **Vercel, the demo project** (`universityflow`, Production environment): delete
   `UF_DEMO_SIGNUP`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
   `NEXT_PUBLIC_FIREBASE_PROJECT_ID` and `NEXT_PUBLIC_UF_DEMO_LOGOS`. **Redeploy** (the
   `NEXT_PUBLIC_*` values are baked in at build time). Check: `/demo/sign-up` answers 404, the
   banner no longer has the "not affiliated" line, `/api/health` answers 200.
2. **Delete the judges' accounts now**, without waiting for the 30-day sweep (it is lazy: it runs
   only when someone starts a learner or signs in, so with nobody visiting it never runs). Either:
   - **delete the demo's database** (Supabase → the demo project → Project Settings → General →
     Delete project) if the demo is being taken down
     as well (docs/deploy/demo.md "Taking it down"); or
   - keep the demo and run, against the demo database only:

     ```sql
     delete from students where id in (select student_id from demo_signups);
     select count(*) from demo_signups;   -- must be 0
     ```

     `demo_signups` rows go with the student (`on delete cascade`). The judges' files (a sample
     report or a kept sample photo) sit in `stored_files` under keys that name no learner; they
     are synthetic, and the demo's own sweep or the database's deletion removes them. If the
     owner wants them gone at once, delete the whole database instead.
3. **Firebase:** console → the demo project (e.g. `universityflow-demo`) → **Authentication →
   Users**: delete every user (this is immediate). Then **Project settings → General → Delete
   project**. Google shuts a project down at once and deletes it for good after a waiting period
   (check the current period on Google's own page on the day; it was 30 days when last read).
4. **Main site project** (only if the demo is being taken down too): delete
   `NEXT_PUBLIC_UF_DEMO_URL` and redeploy, so the landing page drops "Demo for judges".
5. Record in status.md's decisions log the date each step was done (the 30-day promise to judges
   is met by the earlier of step 2 and 30 days after the last sign-up).
6. **Visitors' own photos** (`UF_DEMO_REAL_PHOTOS`, exception D below): delete the variable in the
   demo project and redeploy. Then delete every kept photo now, without waiting for the 24-hour
   reset (it is lazy too). With the demo kept, against the demo database only:

   ```sql
   delete from stored_files where key in (select photo_key from profiles where photo_key is not null);
   update profiles set photo_key = null where photo_key is not null;
   select count(*) from profiles where photo_key is not null;   -- must be 0
   ```

   This removes the samples kept too (they are only drawn pictures). Unlike the sample report and
   sample photos, **these files are real people's faces**: step 2's note that the judges' files
   are synthetic no longer holds for them. Or delete the whole database.
7. **The demo's extra features** (exceptions E, F and G below, added 2026-10-24): in the demo
   project delete `UF_CV`, `UF_MINDMAP_WORDS`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` and
   `ELEVENLABS_MODEL_ID`, and redeploy. Check: `/cv` answers 404, a plan map shows "Writing in
   your own words comes once…", no Read aloud button, `/api/health` 200. Then **revoke the demo's
   ElevenLabs key** (elevenlabs.io → Developers → API keys → delete it). With the demo kept,
   delete the CVs and the plan-map words now, against the demo database only (the sweep is lazy):

   ```sql
   delete from stored_files where key in (select file_key from cv_documents where file_key is not null);
   delete from cv_documents;   -- its share links and reports go with it (on delete cascade)
   delete from cv_entries;
   delete from cv_selections;
   delete from cv_links;
   update plan_map_nodes set text = null, why_not = null, differently = null;
   update plan_maps set title = null;
   select count(*) from cv_documents;   -- must be 0
   ```

   Each CV table hangs off `students` on its own (migration 0035, checked 2026-10-24); check the
   names against 0030 and 0035 again on the day. Or delete the whole database.
8. **Judges' new-learner sign-up** (`UF_DEMO_PHONE_SIGNUP`, exception H below): delete the
   variable in the demo project and redeploy; then, against the demo database only, delete the
   080 accounts as H says (or wait 24 hours for the sweep, or delete the whole database).

## Every change to revert

### A. The judges' real sign-up (`UF_DEMO_SIGNUP`)

**Delete (whole files):**

| File | What it is |
|---|---|
| `apps/web/app/demo/sign-up/page.tsx` | The sign-up page (notice, unticked box) |
| `apps/web/app/demo/sign-up/signup-form.tsx` | The client form; the only `firebase` import (dynamic) |
| `apps/web/app/api/demo/sign-up/route.ts` | `POST /api/demo/sign-up` |
| `apps/web/lib/server/demo/identity.ts` | `firebaseIdTokenVerifier`, `googleSecureTokenKeys`, `fakeIdentityVerifier` |
| `apps/web/lib/server/demo/signup.ts` | `identityVerifier(setting)` |
| `apps/web/test/api-demo-signup.test.ts`, `apps/web/test/demo-identity.test.ts`, `apps/web/test/identity-contract.ts`, `apps/web/test/onboarding-adults-only.test.tsx`, `apps/web/test/demo-signup-csp.test.ts` | Their tests (replaced by the tests below) |
| `packages/db/src/demo-signup.test.ts` | The store's sign-up tests |

**Edit (keep the file, remove the sign-up part):**

| File | Change |
|---|---|
| `apps/web/lib/demo-signup.ts` | Remove `FirebaseWebConfig`, `DemoSignupSetting`, `DemoSignupConfigError`, `readDemoSignup`, `demoSignupOrNull`, `DEMO_SIGNUP_PATH`, `firebaseCspSources`, the fake token (`FAKE_ID_TOKEN_PREFIX`, `mintFakeIdToken`, `readFakeIdToken`). **Keep `readHttpsUrl` and `httpsUrlOrNull`**: the banner's "Back to UniversityFlow" (`components/demo-banner.tsx`) and the landing page (`app/page.tsx`) use them; move them to e.g. `lib/demo-links.ts` and delete the file. Keep `DEMO_SIGNUP_VARIABLES` as a refusal list (below) |
| `apps/web/lib/csp.ts` | Remove the `firebaseAuthDomain` option and the Firebase `script`/`connect`/`frame-src` additions (lines 16, 27–30, 55, 62–74 at 092163c) |
| `apps/web/proxy.ts` | Remove `firebaseAuthDomain(request)` and its import; every page gets the same policy |
| `apps/web/lib/server/config.ts` | Remove `demoSignup` from the config and `readDemoSignupSetting`. **Keep refusing** `UF_DEMO_SIGNUP` and the three `NEXT_PUBLIC_FIREBASE_*` in production and staging, and **now refuse them on a demo too** ("the hackathon sign-up has ended"), so a variable left in Vercel stops the deploy rather than being silently ignored |
| `apps/web/app/page.tsx`, `apps/web/app/sign-in/page.tsx`, `apps/web/app/demo/page.tsx`, `apps/web/app/onboarding/page.tsx` | Drop the sign-up branches: the landing page's ways in go to `/demo`; the picker loses its sign-up line; onboarding loses the adults-only message |
| `apps/web/lib/server/demo/core.ts` | Remove `DEMO_SIGNUPS_PER_IP_PER_HOUR`, the `sweepDemoSignups()` call and the `isDemoSignup` check in "Switch learner"/start |
| `apps/web/lib/server/http.ts`, `apps/web/app/api/me/date-of-birth/route.ts` | Remove the `AdultsOnlyError` mapping |
| `packages/db/src/store.ts` | Remove `DemoSignupIdentity`, `signInDemoSignup`, `isDemoSignup`, `sweepDemoSignups`, the adults-only check in `setDateOfBirth` (lines 1169–1173 at 092163c), the `not exists (… demo_signups …)` clause in `sweepDemoStudents`, and the sign-up's 30-day session cap |
| `packages/db/src/schema.ts` | Remove `demoSignups` |
| `packages/db/src/errors.ts`, `packages/db/src/index.ts` | Remove `AdultsOnlyError` and the exports above |
| `packages/db/src/migrations/` | **Add** the next free migration (see below). Never edit `0034_demo_signups.ts`: migrations are append-only |
| `packages/content/src/en/demo-signup.ts` and `packages/content/src/demo-signup.test.ts` | Remove the sign-up's keys. **Keep** the keys the judge entry and banner still use (`judgeEntryTitle`, `judgeEntryLead`, `backToMain`, and any other key `components/judge-entry.tsx` or `components/demo-banner.tsx` reads): move them to `en.demo` (append) or keep a slimmed `demoSignup` section; wording unchanged, so no new review |
| `packages/content/src/en.ts`, `index.ts`, `sections.ts`, `sections.test.ts` | Follow the content change (append-only rules: never reorder) |
| `apps/web/package.json`, `pnpm-lock.yaml` | Remove the `firebase` dependency (12.19.0); `pnpm install` |
| `apps/web/e2e/demo.spec.ts`, `apps/web/e2e/playwright.demo.config.ts` | Remove the two sign-up journeys and `UF_DEMO_SIGNUP: 'fake'` / the empty `NEXT_PUBLIC_FIREBASE_*`; `/sign-in` no longer offers the sign-up |
| `apps/web/test/demo-signup-config.test.ts`, `apps/web/test/demo-signup-ui.test.tsx` | Keep the main-site/demo switch tests (`NEXT_PUBLIC_UF_DEMO_URL`, `NEXT_PUBLIC_UF_MAIN_URL`, the landing page, the picker, the banner); rewrite the sign-up ones as the "gone" tests below |
| `.env.example` | Remove the `UF_DEMO_SIGNUP` / `NEXT_PUBLIC_FIREBASE_*` block (around lines 238–249 at 092163c) |

**The migration (data):** the next free number when the PR is opened (0036 to 0039 are taken or
reserved today). It refuses while any judge's account is left, then drops the table:

```sql
-- After the FNB hackathon: the judges' real sign-up (0034) has ended (docs/deploy/hackathon-undo-pr.md).
do $$ begin
  if exists (select 1 from demo_signups) then
    raise exception 'demo_signups still has accounts: delete them first (hackathon-undo-pr.md step 2)';
  end if;
end $$;
drop table demo_signups;
```

On production and staging the table was always empty, so it simply goes. On a demo database that
still holds accounts the deploy fails loudly, which is the point.

### B. The universities' logos (`NEXT_PUBLIC_UF_DEMO_LOGOS`)

| File | Change |
|---|---|
| `apps/web/public/demo-logos/` (`tut.svg`, `uct.svg`, `ukzn.png`, `wits.svg`, and `uj.png`, `up.webp` added 2026-10-24) | Delete the folder |
| `apps/web/lib/demo-logos.ts` | Delete |
| `apps/web/public/demo-logos/colleges/` (31 public TVET college logos, added 2026-10-24; each file and its source in docs/deploy/demo.md) | Delete with the folder above |
| `apps/web/components/college-card.tsx` | Remove the `demoLogos` prop and the `DEMO_COLLEGE_LOGOS` import: the neutral mark only |
| `packages/content/src/en/colleges.ts` | Remove `demoLogosNotice` ("College logos are shown for this demo only. UniversityFlow is not affiliated with or endorsed by these colleges."), and its line in `apps/web/components/demo-banner.tsx` |
| `apps/web/components/university-mark.tsx` | Remove the demo-logo branch and its import; the grey mark (or a permitted logo) everywhere |
| `apps/web/components/demo-banner.tsx` | Remove the "not affiliated" line and the `DEMO_LOGOS_ON` import |
| `packages/content/src/en/demo.ts` | Remove `logosNotice` (the "University logos are shown for this demo only. UniversityFlow is not affiliated with or endorsed by these universities." line) |
| `apps/web/app/globals.css` | Delete the `/* demo-logos: … */ … /* end demo-logos */` block (around lines 1405–1434 at 092163c) |
| `packages/catalogue/src/logo-permission.ts` | Remove `DEMO_COLLEGE_LOGO_DIR` and the colleges' exception (and the `collegeIds` argument), and `DEMO_LOGO_DIR` and its exception (lines 26–29 and 96 at 092163c): any logo file again needs a written permission |
| `packages/catalogue/src/logo-permission.test.ts` | Remove the two demo-folder tests and the three demo college-logo tests; add the one below |
| `apps/web/test/college-demo-logos.test.tsx` | Delete |
| `apps/web/test/university-mark.test.tsx`, `apps/web/test/demo-ui.test.tsx`, `apps/web/test/demo-config.test.ts` | Remove the demo-logo cases ("shows the judge demo its logo…", "says the universities' logos are for the demo only…", "a demo may show the universities' logos") |
| `apps/web/lib/server/config.ts` | **Keep** `NEXT_PUBLIC_UF_DEMO_LOGOS` refused in production and staging, and refuse it on a demo too |
| `.env.example` | Remove the `NEXT_PUBLIC_UF_DEMO_LOGOS` block (around lines 232–236 at 092163c) |

### D. A visitor's own photo (`UF_DEMO_REAL_PHOTOS`, added 2026-10-23 late night)

(Listed before C so the code changes sit together.) The samples, the photo pipeline and A11-31's
consent check are **not** part of the exception and stay.

| File | Change |
|---|---|
| `apps/web/lib/server/config.ts` | Remove `demoRealPhotos` from the config. **Keep** `UF_DEMO_REAL_PHOTOS` in `DEMO_ONLY` (refused in production and staging) and refuse it on a demo too ("ended") |
| `apps/web/app/api/me/photo/route.ts` | Remove `samplesOnly` and the demo's file branch: in a demo, any file is refused again (`demo-sample-photo-only`) |
| `apps/web/lib/server/profile-photo.ts` | Remove `DemoRealUploads`, `demoRealUploads` and `PhotoState.realUploads` |
| `apps/web/app/api/me/route.ts`, `apps/web/app/(app)/me/page.tsx` | Drop the `demoRealUploads(…)` argument |
| `apps/web/app/(app)/me/profile-photo.tsx`, `profile-look.tsx`, `me-view.tsx` | Remove the `realUploads` prop and the "Or use your own photo" fieldset |
| `packages/content/src/en/demo.ts`, `packages/content/src/profile-photo.test.ts` | Remove `realPhotoLegend`, `realPhotoLead`, `realPhotoLeadAccount` and their test |
| `apps/web/test/api-demo-real-photos.test.ts`, `apps/web/test/demo-real-photo-picker.test.tsx`, the last `describe` of `apps/web/test/api-demo-db-files.test.ts` | Delete; keep a test that a demo refuses `UF_DEMO_REAL_PHOTOS` and any uploaded file |
| `.env.example`, `docs/deploy/demo.md` | Remove the `UF_DEMO_REAL_PHOTOS` block, its row and exception 3 (mark it ended, with the date) |

### E. My CV on the demo, on the built-in stand-in (`UF_CV=1`, added 2026-10-24)

My CV itself (packages/cv, migration 0035, the routes, the owner's preview) is **not** part of
the exception and stays; only its being allowed on a demo goes.

| File | Change |
|---|---|
| `apps/web/lib/server/config.ts` | In `readCv`, put back the refusal on a demo (`UF_CV is refused on a demo: the judge demo never calls Mmereko (D14)`) in place of the `where.demo` block marked HACKATHON EXCEPTION |
| `apps/web/lib/server/demo/cv-inline.ts` | Delete (`DemoCvEngine`, `InlineCvScheduler`) |
| `apps/web/lib/server/services.ts` | Remove the `demo-cv-inline` block, the `config.demo && config.cvProvider` refusal and `cvScheduler` (the field and its two values); `seedCvDeletions` back to `jobs` |
| `apps/web/app/api/me/cv/drafts/route.ts`, `tailorings/route.ts`, `apps/web/lib/server/cv-routes.ts` (`sendCvDeletions`) | `services.cvScheduler` back to `services.jobs` |
| `apps/web/app/(app)/cv/page.tsx` | Remove the demo's stand-in `Notice` and the `demoPersonas`/`Notice` imports |
| `apps/web/lib/server/demo/personas.ts` | Remove `schoolName` from the clone (and its line in the header comment) |
| `packages/content/src/en/demo-personas.ts`, `packages/content/src/demo-features.test.ts` | Remove `schoolName` and `cvStandIn`, and the test file |
| `apps/web/test/api-demo-features.test.ts` | Delete its CV `describe`s and the page test |
| `apps/web/test/demo-features-config.test.ts`, `apps/web/test/cv-config.test.ts` | Turn "a demo may switch My CV on" back into "a demo refuses UF_CV" (fails while the exception is in) |
| `apps/web/e2e/demo-features.spec.ts` | Delete the two CV journeys |
| `scripts/deploy/demo-smoke.mjs`, `demo-smoke.test.mjs` | Remove the My CV check and `--cv` |
| `scripts/deploy/demo-setup.mjs`, `demo-setup.test.mjs` | Remove the `UF_CV` prompt; refuse `UF_CV` again (`ALSO_REFUSED`) |
| `scripts/deploy/deploy-check.test.mjs` | Put back `['demo', { ...DEMO, UF_CV: '1' }, 'UF_CV', 'REFUSED']` |
| `.env.example` | The `UF_CV` paragraph and the judge-demo paragraph: the demo refuses `UF_CV` again |

### F. Plan-map words on the demo (`UF_MINDMAP_WORDS=1`, added 2026-10-24)

| File | Change |
|---|---|
| `apps/web/lib/server/config.ts` | Put `'UF_MINDMAP_WORDS'` back in `NOT_ON_DEMO` (where the HACKATHON EXCEPTION comment is) |
| `apps/web/test/demo-config.test.ts` | Put `['UF_MINDMAP_WORDS', '1']` back in "refuses a real production marker" |
| `apps/web/test/demo-features-config.test.ts`, `apps/web/test/api-demo-features.test.ts` | Remove the plan-map words cases (or turn them into "a demo refuses UF_MINDMAP_WORDS") |
| `apps/web/e2e/demo-features.spec.ts`, `playwright.demo.config.ts` | Remove the plan-map journey and `UF_MINDMAP_WORDS: '1'` |
| `scripts/deploy/demo-smoke.mjs`, `demo-smoke.test.mjs`, `demo-setup.mjs`, `demo-setup.test.mjs` | Remove the words check, `--plan-words` and the prompt |
| `.env.example`, `apps/web/lib/server/demo/personas.ts` (header comment) | The demo refuses the words again |

### G. Read aloud on the demo (ElevenLabs, added 2026-10-24)

| File | Change |
|---|---|
| `apps/web/lib/server/config.ts` | Put `'ELEVENLABS_API_KEY'`, `'ELEVENLABS_VOICE_ID'` and `'ELEVENLABS_MODEL_ID'` back at the top of `NOT_ON_DEMO`. **Keep** production's A11-30 rule (the key needs `UF_ELEVENLABS_MINORS_APPROVED=1`) untouched |
| `apps/web/test/demo-config.test.ts`, `apps/web/test/demo-features-config.test.ts` | `['ELEVENLABS_API_KEY', 'x']` back in the refused list; remove the "a demo with the key and a voice offers Read aloud" cases |
| `apps/web/test/api-demo-features.test.ts`, `apps/web/e2e/demo-features.spec.ts` | Keep "Read aloud stays off" (it holds after the undo too) |
| `scripts/deploy/demo-setup.mjs`, `demo-setup.test.mjs` | Remove the three ElevenLabs prompts and the key-needs-its-voice check; `refusalFor` says Read aloud stays off on the demo again |
| `scripts/deploy/demo-smoke.mjs`, `demo-smoke.test.mjs` | Remove `--read-aloud`; keep the "Read aloud: off" line |
| `.env.example` | The ElevenLabs and judge-demo paragraphs: the demo refuses ElevenLabs again |

**Tests for E, F and G** (each seen to fail before its revert): a demo refuses `UF_CV=1`; a demo
refuses `UF_MINDMAP_WORDS=1`; a demo refuses `ELEVENLABS_API_KEY` (with and without a voice);
`demo-setup` refuses all three; the demo's `/cv` answers 404 and its plan maps refuse words
(`api-demo-features.test.ts` turned around); production and staging still refuse each, as now.

### H. Judges sign up as a new learner (`UF_DEMO_PHONE_SIGNUP`, added 2026-10-24)

(Listed before C so the code changes sit together.) The owner's decision of 2026-10-24: on the
demo, judges go through the real learner sign-up (number, PIN, date of birth, consent,
onboarding) on made-up 080 numbers, the PIN and a minor's guardian link shown on screen instead
of sent, every account deleted 24 hours after it was made (docs/deploy/demo.md §4b and
"Hackathon exceptions" 4). It added **no migration and no table**: its accounts are ordinary demo
learners, which the demo's 24-hour sweep already deletes.

**The owner's console step (before the PR merges):** delete `UF_DEMO_PHONE_SIGNUP` in the demo
project and redeploy. Check: `/demo` no longer offers "Sign up as a new learner (made-up
details)", `/demo/new-learner` answers 404, `POST /api/auth/request-pin` answers 404
(`pnpm demo:smoke -- --url …` checks it without `--phone-signup`). **The accounts:** none is
older than 24 hours once the sweep has run (every demo start runs it); to be sure at once, against
the demo database only, after the switch is off:

```sql
-- Every learner on the demo with a toll-free (080) number: only this sign-up makes them.
delete from students where phone like '+2780%';
select count(*) from students where phone like '+2780%';   -- must be 0
```

(Their files, if any, sit in `stored_files` under keys that name no learner; the sweep or deleting
the database removes them. Or delete the whole database.)

**Delete (whole files):**

| File | What it is |
|---|---|
| `apps/web/app/demo/new-learner/page.tsx`, `apps/web/app/demo/new-learner/words.ts` | The sign-up page and the words it hands the form and onboarding |
| `apps/web/lib/demo-phone-signup.ts` | The switch (`readDemoPhoneSignup`, `demoPhoneSignupOn`, `DEMO_PHONE_SIGNUP_PATH`, `DEMO_080_ONLY`) |
| `apps/web/lib/server/demo/phone-signup.ts` | `onScreenSignup`, `requireTollFree`, `onScreenPin`, `leaveEarlier`, `consentLinkPath`, and the taken-number guard (`requireFreeOrOwn`, `markOwner`, the `uf_demo_phone` cookie: a browser's keyed hash of the number it signed up with) |
| `packages/content/src/en/demo-phone-signup.ts`, `packages/content/src/demo-phone-signup.test.ts` | The section's words and their test |
| `apps/web/test/api-demo-phone-signup.test.ts`, `apps/web/test/demo-phone-signup-ui.test.tsx`, `apps/web/test/demo-phone-signup-config.test.ts` | Their tests (replaced by the tests below) |
| `apps/web/e2e/demo-phone-signup.spec.ts`, `apps/web/e2e/playwright.demo-phone.config.ts` | The E2E journey and its config (and drop it from `test:e2e:demo` in apps/web/package.json and from `testIgnore` in apps/web/playwright.config.ts) |
| `packages/db/src/demo-phone-signup.test.ts` | The store's tests |

**Edit (keep the file, remove the exception's part):**

| File | Change |
|---|---|
| `apps/web/app/api/auth/request-pin/route.ts`, `apps/web/app/api/auth/verify-pin/route.ts`, `apps/web/app/api/me/guardian/route.ts` | Back to `await refuseInDemo()` first (404 on any demo), as before 2026-10-24; remove the `onScreen` branches |
| `apps/web/app/sign-in/sign-in-form.tsx` | Remove the `demo` prop, the on-screen PIN and the `demo-080-only` sentence |
| `apps/web/app/onboarding/steps.tsx`, `apps/web/app/onboarding/page.tsx` | Remove the `demoPhone` prop: the notice, the guardian's 080 hint, the on-screen link section |
| `apps/web/app/page.tsx`, `apps/web/app/demo/page.tsx`, `apps/web/app/sign-in/page.tsx` | Remove the "Sign up as a new learner (made-up details)" links |
| `apps/web/lib/server/config.ts` | Remove `demoPhoneSignup` and `readDemoPhoneSignupSetting`. **Keep** `UF_DEMO_PHONE_SIGNUP` in `DEMO_ONLY` (refused in production and staging) and refuse it on a demo too ("ended") |
| `apps/web/lib/server/services.ts` | Drop `demoPhoneSignup` from the `Store` options |
| `packages/db/src/phone.ts`, `packages/db/src/store.ts`, `packages/db/src/index.ts` | Remove `normaliseTollFree`, `isTollFreeNumber`, the store's `#phone` (back to `normalisePhone` everywhere) and `demoPhoneHasAccount`; remove the **100-an-hour per-address PIN limit** (`DEMO_OTP_PER_IP_PER_HOUR`, the `demoPhoneSignup` store option, `#otpPerIpPerHour`: back to `OTP_PER_IP_PER_HOUR`, 10, for every store; the owner's approval of 2026-10-24). **Keep** the demo store's session cap and `createdAt` from its clock (every demo learner's sessions end with its 24 hours: not part of the exception) |
| `packages/content/src/en.ts`, `index.ts`, `sections.ts`, `sections.test.ts` | Remove `demoPhoneSignup` (append-only rules: never reorder) |
| `scripts/deploy/demo-smoke.mjs`, `scripts/deploy/demo-smoke.test.mjs` | Remove `--phone-signup` and `checkPhoneSignup`: the 404 check always runs |
| `.env.example`, `docs/deploy/demo.md` | Remove the `UF_DEMO_PHONE_SIGNUP` block, §4b, its rows and exception 4 (mark it ended, with the date) |

**Tests to add (each seen to fail before its fix):** a demo refuses to start with
`UF_DEMO_PHONE_SIGNUP` set ("ended"); on a demo, `request-pin`, `verify-pin` and the guardian
request answer 404 whatever the environment; `/demo/new-learner` answers 404; a demo store refuses
an 080 number (`InvalidPhoneError`), as every store does; a demo store allows 10 PIN requests an
hour per address, not 100. **Keep** the onboarding fix (the waiting step follows the server's
step after "Continue"; apps/web/test/onboarding.test.tsx): it is not part of the exception.

### I. The demo's university learners record the DRAFT adult-v3 (module outlines, added 2026-10-24)

(Listed before C so the code changes sit together.) Phase 6b's module outlines need consent
wording that names them: guardian v4 or adult-v3 (D9), owed legal review and not live. Migration
0040 refuses an outline upload under anything older, for every learner, and that gate is **not**
part of the exception and stays. So that the judges can upload the generator's SAMPLE outline end
to end, the demo's three made-up university learners (first year at UJ, second year at Wits, final
year at UCT) agree in their own name to the draft wording, recorded as `adult-v3-draft-demo-only`
(`DEMO_DRAFT_ADULT_CONSENT_VERSION`). No real person agrees to it, and nothing else changes: every
other learner, the demo's on-screen sign-up included, agrees to the live wording and is refused an
outline. Side effect to know: the draft adult-v3 also names the profile photo (C5), so those three
made-up learners' consent covers a photo without the preview stand-in (the demo shows SAMPLE
photos only unless exception D is on). It added **no migration**: its records are ordinary demo
learners, which the 24-hour sweep deletes.

**The owner's console step:** none (no variable). The accounts go with the demo's sweep.

| File | Change |
|---|---|
| `apps/web/lib/server/demo/outline-consent.ts` | Delete (`DEMO_DRAFT_ADULT_CONSENT_VERSION`) |
| `apps/web/lib/server/demo/personas.ts` | In `consent`, remove the `demo-outline-consent` block: every adult persona agrees to `en.adultConsent.version` again |
| `apps/web/test/demo-personas.test.ts` | Turn "a university year records the DRAFT adult-v3…" into "every persona records the live wording, and a university year is refused an outline until the real adult-v3 is live" |
| `apps/web/test/api-demo-outlines.test.ts` | The mocked seed records the live wording; the end-to-end case expects 403 `consent-outdated` / `module-outlines` (or is removed until adult-v3 is live) |
| `docs/legal/consent-v4-draft.md` | C9's demo line: mark it ended, with the date |

Keep: the SAMPLE outlines (tools/results-generator, apps/web/lib/server/demo/sample-outlines.ts),
`/api/demo/sample-outline` and its button (they keep working for a learner whose consent names
outlines), and migration 0040's gate.

**Test to add (seen to fail before the revert):** a cloned university persona's adult agreement is
`en.adultConsent.version`, and `/api/demo/sample-outline` answers 403 `consent-outdated` with detail
`module-outlines` for it while the live adult wording is older than adult-v3.

### C. Documents

| File | Change |
|---|---|
| `docs/deploy/demo.md` | Remove §4 "The judges' real sign-up", the sign-up and logo rows of the variables table, the logos section, the sign-up checks in §6; turn "Hackathon exceptions" into a short dated record ("ended on DATE, undone by #PR") |
| `docs/brand/logo-permissions.md` | Mark the "One exception, for the FNB hackathon only" paragraph as ended, with the date and PR |
| `docs/store/privacy-and-data-safety.md` | Remove the `demo_signups` row (line 177 at 092163c), or mark it "dropped by migration 00NN (its number)" |
| `planning.md` §20 | Add a dated row: both exceptions ended, the accounts deleted on DATE |
| `status.md` | The integrator records the PR, the console steps' dates and the migration number |
| this file | Delete it in the same PR, or keep it with "done on DATE" at the top |

## Tests that must be added (each seen to fail before its fix, as rule 10 asks)

(Exceptions E, F, G and H list their own tests above.)

| Test | Where | Fails today because |
|---|---|---|
| A demo refuses to start with `UF_DEMO_SIGNUP` or any `NEXT_PUBLIC_FIREBASE_*` set ("ended") | `apps/web/test/demo-signup-config.test.ts` (renamed e.g. `demo-hackathon-ended.test.ts`) | a demo accepts them |
| A demo refuses to start with `NEXT_PUBLIC_UF_DEMO_LOGOS` set | same file | a demo accepts it |
| `/demo/sign-up` and `POST /api/demo/sign-up` answer 404 on a demo, whatever the environment | same file, or a route test | the page and route exist |
| `buildCsp` takes no Firebase sources: the policy on `/demo/sign-up` equals the policy on `/` and names no Google domain | `apps/web/test/csp.test.ts` (or the existing CSP test file) | the sign-up page's policy is wider |
| No source file imports `firebase`, and `apps/web/package.json` has no `firebase` | keep the existing "no other source file imports firebase" check, tightened to "no file" | the form imports it |
| After every migration, `demo_signups` does not exist; and the new migration refuses while a row is left | `packages/db/src/migrations.test.ts` | the table exists |
| The logo scan finds no `demo-logos` folder anywhere, and a file planted there fails the scan (proven on a broken example, as the existing scan test is) | `packages/catalogue/src/logo-permission.test.ts` | `DEMO_LOGO_DIR` is an allowed exception |
| The demo banner never shows a logos line; `UniversityMark` never draws a non-permitted logo, demo or not | `apps/web/test/demo-ui.test.tsx`, `apps/web/test/university-mark.test.tsx` | the demo branch draws one |

**Kept unchanged:** the made-up learners' tests (`demo-ui`, `demo-config`, the picker, "Switch
learner", the 24-hour sweep, sample photos, sample reports, files in Postgres, the AI cap), the
main-site switch tests (`NEXT_PUBLIC_UF_DEMO_URL`, `NEXT_PUBLIC_UF_MAIN_URL`), the
`logoPermission` tests, and every production/staging refusal of a `UF_DEMO_*` variable.

## Test plan (for the PR)

- [ ] Console steps 1–3 done and dated; `select count(*) from demo_signups` is 0 on the demo database (or the database is deleted)
- [ ] `pnpm lint`, `pnpm check`, `pnpm check:test`, `pnpm typecheck`
- [ ] Uncached unit suites: web, db (`TEST_DATABASE_URL` real-Postgres suite too, for the migration), catalogue, content
- [ ] Red team (`pnpm --filter @universityflow/evals test`) at 100%: packages/content changes (hard rule 7)
- [ ] Web build; root and client chunk budgets (the bundle loses `firebase`'s dynamic chunk)
- [ ] E2E main suite and the demo suite (`test:e2e:demo`) against a production build, with axe
- [ ] On the deployed demo after merge, at 360 px: `/` → "Demo for judges" → the six learners; `/sign-in` shows the picker only; `/demo/sign-up` 404; banner without the logos line; every university shows the grey mark; `/api/health` 200
- [ ] On the main site: unchanged (or, if the demo is taken down, no "Demo for judges")
- [ ] Firebase project shows as shut down / pending deletion; Vercel variables gone
- [ ] E, F, G: `UF_CV`, `UF_MINDMAP_WORDS` and the `ELEVENLABS_*` gone from the demo project; the demo's ElevenLabs key revoked; on the deployed demo `/cv` 404, plan maps say writing comes later, no Read aloud button; `pnpm demo:smoke` without `--cv`, `--plan-words` or `--read-aloud` passes and reports all three off

## Not part of this PR (separate decisions)

- **Gemini** (`UF_AI_PROVIDER`, `GEMINI_API_KEY`) is not a hackathon exception: it is a demo-only
  second model, refused in production. A10-46 (Gemini's terms are 18+) stays open for the owner and
  legal; the demo runs on Anthropic meanwhile.
- **Taking the demo down altogether** is docs/deploy/demo.md "Taking it down": delete the demo's
  Vercel project and database.
