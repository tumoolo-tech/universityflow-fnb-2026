# The judges' app: an Android APK pointed at the live demo, and what iPhone judges do

For the owner, for the FNB hackathon (deadline **Mon 26 Oct 2026, 23:59**). Written 2026-10-25.

**In one line:** Android judges install an APK from a link or QR code and sign up inside the app
as a new made-up learner on the live demo (<https://universityflow.tumoolo.tech>). iPhone judges
use the same live demo in Safari. Nothing here needs Google Play, an Apple account or a secret.

| Phone | The route (recommended) | Cost | Your effort | Judge's effort |
|---|---|---|---|---|
| **Android** | **APK from EAS Build (`preview` profile), shared as a link and QR code** | Free (Expo's free plan) | About 30 minutes of typing, then 15–60 minutes waiting for the build | Scan, download, allow the install, open: about 3 minutes |
| **iPhone** | **The live web app in Safari** (<https://universityflow.tumoolo.tech>) | Free | None: it is already live | Open the link |

The other iPhone routes, and why none of them is the recommendation, are in "iPhone" below.

## What a judge sees in the Android app

1. The app opens on **"Sign up as a new learner"**, with a card first: *This is the judges'
   demo*, made-up details only, a made-up number starting with **080** (never a cellphone), no SMS,
   deleted within 24 hours. (The words are the web demo's own.)
2. They type a made-up 080 number (10 digits, e.g. `0800 000 123`) and press **Send my PIN**. The
   demo sends nothing: the next screen shows **"Your demo PIN"** and the six digits. They type it.
   A cellphone number is refused with "On the demo, use a made-up number that starts with 080…".
   A number another judge already used is refused with "Someone has already signed up with that
   made-up number…": pick another.
3. Date of birth. **Tell judges to give an adult one (e.g. 2000-01-01):** that goes straight to the
   adult agreement, then the grade, then the app. (An under-18 date works too: the guardian step
   takes an 080 number, and the app shows *"Nothing was sent: here is the guardian's link"*; it
   opens the consent page in the phone's browser, they agree as the made-up guardian, come back
   and press **Check again**.)
4. Then the real learner app: home, chat with the AI (lists and bold words shown properly), My
   results ("Type my marks in instead"), what I need, offers, campus, plan maps, About me.

What the app does **not** have that the web demo has, so point judges to the web for these:

- the **six ready-made learners** (Grade 10, 11, 12, first, second and final year): the picker is
  on the web only (`/demo`);
- **"Use a sample report"**: the demo only reads its own SAMPLE PDFs, and a phone has none, so a
  photo of a report is refused. In the app, judges type their marks in instead;
- the sample profile photos.

Signing out loses the account for the app: the same made-up number can't be used again from the
app (the demo keeps each number for the browser that made it, and the app keeps no cookies).
Use a new made-up number. Every demo account is deleted after 24 hours.

## Android: step by step (only you can do these)

Everything is typed in **PowerShell**. Use the main checkout once this branch is merged:
`C:\Users\tumom\Tumoolo-Tech\UniversityFlow`. No secret is typed anywhere: the three values below
are plain text (an id, a web address and a `1`), and every `EXPO_PUBLIC_` value is readable by
anyone who has the app.

### Once: the Expo account and the project

1. **Make an Expo account.** In the browser, open <https://expo.dev/signup>. Sign up with the
   Tumoolo email (a company account: the project and its builds live under it). Confirm the email.
2. **Sign in from PowerShell** (any folder):

   ```powershell
   cd C:\Users\tumom\Tumoolo-Tech\UniversityFlow\apps\native
   npx eas-cli@latest login
   npx eas-cli@latest whoami
   ```

   `login` asks for the email (or username) and password. `whoami` prints your username.
3. **Link the project** (still in `apps\native`):

   ```powershell
   npx eas-cli@latest init
   ```

   Answer **yes** to "create a project". Because `app.config.ts` is code, EAS can't write the id
   into it: it **prints the project id** (looks like `1a2b3c4d-1111-2222-3333-444455556666`) with
   a message about `extra.eas.projectId`. **Copy that id.** Don't edit any file: the config reads
   it from `UF_EAS_PROJECT_ID`.

### Once: the three values the judges' build needs

4. **Store them in the project's `preview` environment at EAS** (still in `apps\native`; put your
   id in place of `<project id>`, without the angle brackets):

   ```powershell
   npx eas-cli@latest env:create --environment preview --name UF_EAS_PROJECT_ID --value <project id> --visibility plaintext
   npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_UF_API_URL --value https://universityflow.tumoolo.tech --visibility plaintext
   npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_UF_DEMO --value 1 --visibility plaintext
   ```

   If a command asks which scope, choose **project**. The same can be done by clicking: expo.dev →
   the **universityflow** project → **Environment variables** → **Add variable**: name, value,
   environment **Preview** only, visibility **Plain text**.
   `EXPO_PUBLIC_UF_DEMO=1` makes the sign-in screen say first that it is the judges' demo.
5. **Set the same three in this PowerShell window too** (the build reads the config on your
   computer first; this makes sure it sees them):

   ```powershell
   $env:UF_EAS_PROJECT_ID = "<project id>"
   $env:EXPO_PUBLIC_UF_API_URL = "https://universityflow.tumoolo.tech"
   $env:EXPO_PUBLIC_UF_DEMO = "1"
   ```

### Each build

6. **Build the APK** (in `apps\native`, the same window):

   ```powershell
   npx eas-cli@latest build --platform android --profile preview
   ```

   - "Generate a new Android Keystore?" → **yes**. EAS keeps it.
   - If it asks to install `expo-dev-client` or `expo-updates`, or to change any file: answer
     **no** and tell the integrator. Nothing should need changing.
   - The build runs on Expo's servers: 15–30 minutes, longer in the free queue. **Start by Monday
     midday** so there is time for one retry.
   - It refuses at once, in one line, if `UF_EAS_PROJECT_ID` is missing or `EXPO_PUBLIC_UF_API_URL`
     isn't `https://`: that is the config protecting you (A7-21, A7-05); redo steps 4–5.
   - If it fails later: open the link it printed, copy the first red line, send it to the integrator.
7. **Find the link and the QR code.** When it finishes, PowerShell prints a link like
   `https://expo.dev/accounts/<you>/projects/universityflow/builds/<id>` and a QR code. The same is
   on expo.dev → **universityflow** → **Builds** → the newest **Android · preview** build: it has
   an **Install** button (shows the QR code) and a **Download** button (the `.apk` file).
   **Check the link works for someone who isn't you:** open it in a private (incognito) window,
   signed out of Expo. If it asks for an Expo sign-in, download the `.apk` instead and share that
   file through a link that needs no account (e.g. Google Drive → Share → "Anyone with the link").
8. **Try it on your own Android phone first** (next section), right through to a chat reply.

### How a judge (or you) installs it on Android

1. Scan the QR code with the camera, or open the link, on the Android phone (Android 10 or newer).
2. Tap **Install** (or **Download**), and open the downloaded `UniversityFlow….apk`.
3. Android says the browser isn't allowed to install apps: tap **Settings**, turn on **Allow from
   this source**, go back, tap **Install**. (Settings → Apps → Special app access → Install
   unknown apps → the browser, on some phones.)
4. Play Protect may warn that the app is unknown: tap **More details → Install anyway** (or let it
   scan). The app appears as **UniversityFlow**.
5. Open it and follow "What a judge sees" above.

### What to paste in the submission

> **Try UniversityFlow**
> - **Any phone or computer:** <https://universityflow.tumoolo.tech> → "Demo for judges", pick a
>   made-up learner, or sign up as a new one. Made-up details only.
> - **Android app:** <the link from step 7> (or scan the QR code). Allow the install from your
>   browser when Android asks. In the app, sign up with a made-up number that starts with 080, e.g.
>   0800 000 123: your PIN is shown on screen (no SMS). Use an adult date of birth such as 2000-01-01.
> - **iPhone:** use the web link above in Safari (Share → Add to Home Screen to keep it as an icon).
>   The iOS app needs Apple's TestFlight review, which isn't possible before the deadline.
> - Every demo account is deleted within 24 hours. Please don't type real personal details.

Add the QR code image (expo.dev's Install button → screenshot the code) to the deck if there is room.

### After the hackathon

Delete the three `preview` variables (expo.dev → Environment variables, or
`npx eas-cli@latest env:delete --environment preview --name EXPO_PUBLIC_UF_DEMO`, and the same for
the other two once a real preview server exists), and stop sharing the build link (expo.dev → the
build → delete). This build talks to the demo only; it is not the store app.

## iPhone: every realistic option

| Option | Does it work for UniversityFlow? | Cost | Effort and time | Verdict for 26 Oct |
|---|---|---|---|---|
| **The live web app in Safari** | Yes: the whole demo, the six learners and the sample report included, already live (the demo smoke walks it at 360 px) | Free | None for you; the judge opens a link | **Recommended** |
| **Expo Go** (Expo's own app from the App Store, which runs a project's JavaScript) | Technically the app's code would run: it has **no custom native code** (no `android/` or `ios/` folders, no local config plugins; every native module it uses is one Expo Go ships: expo-router, expo-secure-store, expo-splash-screen, expo-notifications, expo-audio, expo-image-picker, expo-document-picker, expo-file-system, react-native-svg, react-native-screens, react-native-safe-area-context). **But** Expo Go runs only the newest Expo SDK, and only loads code from a running computer (`expo start --tunnel` on your laptop, left on through judging) or from an EAS Update, which needs `expo-updates`, a new native module the app doesn't have. Push notifications don't work in Expo Go. | Free | Your laptop must stay on and connected for every judge, or a new module and a new build | Not recommended. Not tried on a phone. |
| **EAS internal distribution for iOS** (an `.ipa` installed from a link, like the APK) | Yes, once built | **Apple Developer Program, US$99 a year** | Enrol (Apple can take 1–2 days to approve a company), then **every judge's iPhone UDID registered** before the build (`eas device:create` gives them a link to do it), then build, then install. A judge you didn't register can't install it | Not possible in time for unknown judges |
| **TestFlight** | Yes, once reviewed | **US$99 a year** (the same programme) | Enrol, an App Store Connect record, an EAS iOS build, upload, then **Apple's beta review, usually about a day** (can be longer, can reject). Judges install the TestFlight app and open your public link | Too slow for Monday; right for after the hackathon |

So: **Android judges get the APK; iPhone judges, and anyone who'd rather not install, use the web
link.** After the hackathon, TestFlight (then the App Store) is the iOS route
(docs/store/release-checklist.md).
