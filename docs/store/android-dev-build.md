# The app on your Android phone: a development build, step by step (Windows)

For the owner. The app has never run on a phone; this gets it onto yours in about an hour, most
of it waiting for EAS to build. Nothing here needs a Google Play account or a Firebase project.
Every command is typed in **PowerShell**, in the repo folder unless a step says otherwise. No
secret is typed into a file, and none goes into the repo.

**What a development build is.** An app on your phone that holds the native parts (camera, secure
storage, notifications, the drawings) but loads its screens from your computer while you test.
So the computer and the phone must be on **the same Wi-Fi**, and two things run on the computer:
the web app (the API the app talks to) and Metro (which serves the app's screens). Once built, you
rebuild only when a native module changes; screen changes arrive by reloading.

## Before you start (once)

1. **Check the dev client is in the app.** Open `apps/native/package.json` and look for
   `"expo-dev-client"` under `dependencies`. If it is missing, ask the integrator to add it
   (`pnpm --filter @universityflow/native add expo-dev-client@~57.0.19`, the version Expo SDK 57
   lists) and merge it first. Without it, EAS stops at step 7 and offers to install it for you;
   say no and ask, so the lockfile changes in a reviewed branch, not on your laptop only.
2. **Install the tools.** Node 24 and pnpm 10 are already on this machine. Then:

   ```powershell
   npm install --global eas-cli
   eas --version
   ```

   The version must be 16 or newer (`apps/native/eas.json` asks for it).
3. **The Android phone.** Android 10 or newer. In Settings → Security (the name varies), allow
   your phone's browser to **install unknown apps**: the build is an APK from expo.dev, not
   from Play. Charge it, and connect it to the same Wi-Fi as this computer.

## Make the EAS project (once)

4. **An Expo account.** Sign up at <https://expo.dev/signup> with the Tumoolo email (a company
   account, not a personal one: the project, its builds and later its store credentials live
   under it). Then sign in from PowerShell:

   ```powershell
   eas login
   eas whoami
   ```

5. **Create the project.**

   ```powershell
   cd apps\native
   eas init
   ```

   Choose the Tumoolo account if it asks which owner. Because `app.config.ts` is code, EAS
   **prints the project id instead of saving it**, with a message about adding
   `extra.eas.projectId`. Copy the id (it looks like `1a2b3c4d-....-....-....-............`).
   You don't edit any file: the config reads the id from `UF_EAS_PROJECT_ID`. If you created the
   project under an organisation rather than your own user, tell the integrator its name: the
   config may then need an `owner` line.

6. **Set the two variables, at expo.dev and in your shell.** At
   <https://expo.dev> → the **universityflow** project → **Environment variables** → *Add*:

   | Name | Value | Environments | Visibility |
   |---|---|---|---|
   | `UF_EAS_PROJECT_ID` | the id from step 5 | development, preview, production | **Plain text** (not a secret: it names the project) |
   | `EXPO_PUBLIC_UF_API_URL` | for **development**: leave it unset (you set it in your shell, step 9). For **preview** and **production**: the real server's `https://` address, when there is one | preview, production | **Plain text** (every `EXPO_PUBLIC_` value is built into the app, so anyone with the app can read it: an address only, never a key) |

   Then in PowerShell, for this window:

   ```powershell
   $env:UF_EAS_PROJECT_ID = "<the id from step 5>"
   ```

   Every EAS build refuses to start without this id and says so in one line naming
   `UF_EAS_PROJECT_ID` (finding A7-21); a preview or production build also refuses a missing or
   non-`https` `EXPO_PUBLIC_UF_API_URL` (A7-05). Those refusals are the config working, not a bug.

## Build and install

7. **Build the development APK** (in `apps\native`):

   ```powershell
   eas build --profile development --platform android
   ```

   - It asks to **generate a new Android keystore**: answer **yes**. EAS keeps it; it signs
     your test builds only. (Back the keystore up later with `eas credentials` before the first
     store release; losing it means a new app listing.)
   - The build runs on Expo's servers: about 15–30 minutes, longer in the free tier's queue. The
     page link it prints shows the progress and the log.
   - If it fails, open that link, copy the first red error line, and send it with step 15.

8. **Install it on the phone.** When the build finishes, EAS prints a link and a QR code. On the
   phone, scan the QR code with the camera (or open the link from expo.dev → Builds), tap
   **Install**, download the `.apk`, and open it. Android warns that it comes from outside Play;
   choose to install anyway (Play Protect may ask to scan it: let it). The app appears as
   **UniversityFlow** with the placeholder icon.

## Point it at a server, and run

9. **Start the web app the phone will talk to.** Find this computer's Wi-Fi address:

   ```powershell
   ipconfig
   ```

   Under *Wireless LAN adapter Wi-Fi*, the **IPv4 Address**, e.g. `192.168.1.23`. Either:

   - **Your preview server** (UniversityFlow-preview on port 3005, the one with your switches
     on): it is already running. Its address for the phone is `http://192.168.1.23:3005`.
   - **Or a fresh local server** on port 3000, in a new PowerShell window:

     ```powershell
     pnpm --filter @universityflow/web dev
     ```

     Its address for the phone is `http://192.168.1.23:3000`.

   The first time the phone connects, **Windows Firewall** asks whether Node.js may accept
   connections: allow it on **Private networks** only (your home Wi-Fi must be set to Private in
   Windows' network settings, never Public). Check from the phone's browser that
   `http://192.168.1.23:3005/api/health` (or `:3000`) answers before going on.

   **Not the judge demo.** <https://universityflow.vercel.app> has no phone PIN sign-in (the demo
   signs judges in with personas or Firebase, both on the web only), so the app can't sign in
   there. The development build talks plain `http` to your computer; a store build will only ever
   talk `https`.

10. **Start Metro with that address** (in a third PowerShell window, from the repo folder):

    ```powershell
    $env:EXPO_PUBLIC_UF_API_URL = "http://192.168.1.23:3005"
    pnpm --filter @universityflow/native dev
    ```

    Metro prints a QR code and an address like `exp+universityflow://expo-development-client/?url=http%3A%2F%2F192.168.1.23%3A8081`.
    If you change the address, stop Metro (Ctrl+C) and start it again with `--clear` at the end
    of the command (`pnpm --filter @universityflow/native dev -- --clear`): the address is built
    into the screens when Metro serves them.

11. **Open the app on the phone.** It shows the development launcher: tap the server it lists
    (`http://192.168.1.23:8081`), or scan Metro's QR code with the phone's camera. The first load
    takes a minute; then the sign-in screen appears. Shake the phone (or press `m` in Metro's
    window) for the developer menu: **Reload** after a code change.

12. **Sign in with the PIN from the outbox.** Type a made-up cellphone number (the app accepts
    only cellphone prefixes: 06x, 071–079 or 081–084, then seven digits). Don't use your own or
    anyone's real number, so nothing real ends up in a screenshot. Ask for a PIN. No SMS is sent:
    the local server keeps it. On this computer, open <http://localhost:3005/dev/outbox> (or `:3000`), read the
    six-digit PIN from the newest line, and type it into the phone within ten minutes. The
    outbox only exists on a local server.

## What to test first

13. In this order, each on the phone, then again with **Settings → Display → Font size** at the
    largest and with **TalkBack** on (Settings → Accessibility):

    1. **Sign-in and onboarding**: the PIN, the date of birth (under 13 is refused), a guardian
       step for under 18 (the guardian's consent link is in the outbox too).
    2. **Upload my report**: "Take a photo" asks for the camera only then; photograph a printed
       page or a **synthetic** report (never a real learner's: hard rule 4). With no AI key the
       local server reads a sample draft and the screen says so ("sample"); "Type my marks in
       instead" works without a photo.
    3. **My results** and **My school record** (the card under the results): every report you
       confirmed side by side, nothing cut off at the right edge.
    4. **About me**: the card and *Make it yours*; the photo buttons appear only if your server
       has `UF_PROFILE_PHOTO=1` (the preview does).
    5. **My goal → My plan maps**: start a map, mark a part "Not achieved", save.
    6. **My CV** (About me → My CV): only if your server has `UF_CV=1`; otherwise there is no
       link, as learners will see it.
    7. **Notifications**: tapping "Turn on" shows Android's prompt. Push messages themselves
       won't arrive yet (that needs the Firebase key, release-checklist.md §1): the app should
       say it couldn't turn them on, not crash.
    8. **Delete my account** (About me), last.

    Note anything that runs off the screen, can't be reached, or reads wrongly aloud.

## When something breaks

14. **A red screen** is the development build showing a JavaScript error: take a screenshot of
    the whole screen (the message and the first lines under it matter). Tap *Reload*; if it
    comes back, note the steps that lead to it. **A plain crash** (the app closes): note what
    you tapped just before, the time, and whether it happens again.
15. **Report it** to the integrator (or as a GitHub issue) with: the phone's make and model, its
    Android version (Settings → About phone), the build's link from expo.dev, the screen, the
    steps, the screenshot, and the last lines of the Metro window. Never include a real
    person's phone number, name, marks or document (blank out the made-up number too, by habit).

## Afterwards

- Stop Metro and the local server with Ctrl+C when you are done. The app on the phone stays
  installed; next time, start steps 9–11 again (no rebuild).
- **Rebuild (step 7)** only when the integrator says a native module changed (for example after
  the react-native-svg batch, or when `expo-dev-client` is added).
- A **preview build** (`eas build --profile preview --platform android`) is a standalone APK
  that needs no computer, but only talks to an `https://` server with phone sign-in: there is
  none yet (the demo has no PIN sign-in). It comes with the store release, release-checklist.md §3.
