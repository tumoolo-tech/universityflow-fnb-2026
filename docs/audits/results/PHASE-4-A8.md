# PHASE-4 — A8 Dependencies and supply chain

**Project:** UniversityFlow · **Phase:** 4 · **Date:** 2026-10-14
**Commit:** 7d53bc6 (branch `phase-4/audits`) · **Audit source:** tumoOLO_Audits @ 29eafd7
**Result:** 0 Critical · 0 High open (A8-01 High stays Accepted, re-checked) · 1 Medium · 3 Low · 1 accepted carried · 3 not measured

---

## 1. Executive summary

The dependency picture is about the same as at Phase 3. `pnpm audit` (prod and full) gives the
same 5 advisories as on 2026-10-13: 2 High that are ignored by exact GHSA id (A8-01) and 3
Moderate. Phase 4 added very little to the tree. Seven registry packages are new, all MIT: five
first-party Expo SDK 57 modules plus `expo-application`, `expo-image-loader` and `badgin`. There is
one new workspace package (`packages/jobs`, dev dependencies only). `sharp` moved from a transitive
dependency of Next to a direct, exact-pinned runtime dependency of `packages/documents`. Push goes
to Expo through a hand-written `fetch` adapter (`packages/messaging/src/expo-push.ts:29`), not an
SDK. That keeps a dependency out of the server path. The CLAUDE.md version pins are intact.

Top risks:

1. **A8-02**: `decode-uri-component` ≤0.4.2 is reachable on the phone. expo-router parses every
   incoming `universityflow://` deep link with `query-string`, and nothing filters the link first.
2. **A8-01 (carried)**: node-forge and braces High advisories still have no patched release. The
   reachability argument still holds.
3. **A8-03**: GitHub-owned actions and the shared audit suite are referenced by moving refs (`@v7`,
   `ref: main`) in jobs that hold `ANTHROPIC_API_KEY` or `pull-requests: write`.
4. **A8-04**: the pnpm build-script allowlist names four packages that run no install script.
5. `sharp`/libvips now decodes untrusted uploads on the server. pnpm audit cannot see libvips (C)
   CVEs (Not measured, below).

**Graph size:** about 1,090 packages in `pnpm-lock.yaml` (1,093 at Phase 3 + 7 new + `packages/jobs`).
978 are installed on win32-x64, where platform-specific optional packages are skipped.

---

## 2. Findings

| ID | Severity | Location | Finding | Why it matters | Fix |
|---|---|---|---|---|---|
| A8-01 | High, **Accepted (carried, re-checked)** | `package.json:39-43` (`pnpm.auditConfig.ignoreGhsas`) | node-forge 1.4.0 (GHSA-86w9-cpqp-85rv, RSA PKCS#1 v1.5 signature forgery) and braces 3.0.3 (GHSA-vfj7-8cjw-p6xm, stack exhaustion from nested braces) are still unpatched. GitHub API on 2026-10-14: `first_patched_version: null` for both (advisories last updated 2026-10-01 and 2026-10-02). npm `latest` is still node-forge 1.4.0 and braces 3.0.3. | Reachability still holds (§3). `pnpm why` shows node-forge only under `@expo/cli` and `@expo/code-signing-certificates`, the dev server and update signing on a developer machine. braces appears only through `micromatch` under metro / `@expo/metro-file-map` / jest. Neither is in `apps/web` or any server package, and neither is in the Metro app bundle. Phase 4's new Expo modules add more paths *up* to `expo`, but no new consumer of either package. **Correction to status.md:351:** braces comes through metro and jest's `micromatch` as well as `@types/jest`. | Keep the exact-id ignores. Remove each id the day a patched release ships. Re-check at the next Expo SDK upgrade. |
| A8-02 | Medium | `apps/native/app.config.ts:58` (`scheme: 'universityflow'`); `node_modules/expo-router/build/react-navigation/core/getStateFromPath.js:41`; no `apps/native/app/+native-intent.tsx` | `decode-uri-component@0.2.2` (GHSA-vcc3-ghjq-m6fr, CVSS 4.0 6.6, exponential decoding of malformed percent-encoding) comes in through `expo-router > query-string@7.1.3`. expo-router runs `queryString.parse` on the path of every deep link it receives. Nothing filters or caps a link before the router parses it. | **Reachable on the device.** Anyone can send a student a crafted `universityflow://…` link, for example in WhatsApp or SMS, which this phase makes a primary channel. Tapping it pins the JS thread and freezes the app. Impact: a denial of service for one user, recovered by force-quitting the app. No data is exposed. The patched 0.5.0 is ESM-only (`"type": "module"`), so a `pnpm.overrides` entry would break `query-string@7`'s CommonJS `require` under Jest. An override is not a safe fix. | Add `app/+native-intent.tsx` with a `redirectSystemPath` that sends any incoming path longer than a fixed cap (e.g. 2,048 chars), or with malformed `%` sequences (`/%(?![0-9A-Fa-f]{2})/`), to `/` before expo-router parses it. Keep the advisory listed until expo-router moves to `query-string@9+`, then re-run this audit. |
| A8-03 | Low | `.github/workflows/ci.yml:57,63,100,106,126,141,147,166`; `audits.yml:68,73,112,121-124,139,181,195,201-204,221,248,254-257,272,295,302-305,359,364-368,372,414`; `claude.yml:41,54`; `.github/dependabot.yml:56` | Third-party actions are pinned by SHA: `pnpm/action-setup`, `anthropics/claude-code-action`, `anthropics/claude-code-security-review`. But every `actions/checkout@v7`, `actions/setup-node@v6` and `actions/upload-artifact@v6` uses a moving tag. The shared suite is checked out at `ref: main`, and `audits.yml:159,232,283,397` then runs it with `node`. `dependabot.yml:56` says "Actions are pinned by SHA", which is only partly true. `claude.yml:54` says v1.0.236 next to a SHA labelled v1.0.237. | A moved tag runs new code in jobs that hold `ANTHROPIC_API_KEY` (claude.yml, the A9 and prompt-audit jobs) or `pull-requests: write`. GitHub-owned actions are a lower-probability target than third-party ones, and the suite is the owner's own private repo. That is why this is Low. Dependabot already maintains SHA pins, so the fix costs almost nothing. | Pin each `actions/*` reference to its full commit SHA with a `# vX.Y.Z` comment; Dependabot keeps them current. Pin the suite checkout to the audited SHA (`29eafd7…`) and bump it deliberately. Fix the `claude.yml:54` comment. |
| A8-04 | Low | `pnpm-workspace.yaml:7-12` (`onlyBuiltDependencies`) | Of the five packages allowed to run lifecycle scripts, only `lefthook@2.1.14` has one (`postinstall: node postinstall.js`). `esbuild` and `unrs-resolver` are not in the lockfile at all. `sharp@0.35.5` and `@biomejs/biome@2.5.14` ship no install, preinstall or postinstall script; they use prebuilt optional `@img/*` and `@biomejs/cli-*` packages. A scan of all 978 installed packages found no other install script and no `binding.gyp`. | The allowlist is meant to list exactly the code that runs on every machine and CI install (`pnpm-workspace.yaml:5-6`). As it stands, four stale entries mean a future esbuild, unrs-resolver, sharp or biome release could add an install script, and it would run without anyone reviewing it. | Cut the list to `lefthook`. Add an entry back only when a package in the tree actually needs it. |
| A8-05 | Low | `packages/db/package.json` (`zod ^4.6.5`), `packages/documents/package.json:25` (`zod ^4.4.3`), `apps/web/package.json` (`zod ^4.6.7`); `pnpm-lock.yaml` | `pnpm dedupe --check` fails. zod resolves to both 4.6.5 (db, documents) and 4.6.7 (web), and `@anthropic-ai/sdk@0.133.0` is resolved twice, once against each zod. | Two zod copies mean schemas built in `packages/db` or `documents` are separate instances from those in `apps/web`. That works today, but an `instanceof ZodError` check across the boundary or a shared error map would quietly fail. It also adds avoidable bundle weight. | Run `pnpm dedupe`, and align the zod ranges to one floor (`^4.6.7`). |

### Advisories (`pnpm audit --prod` and `pnpm audit`, identical output)

| Package@version | Advisory | Severity | Path | Reachable | Fix |
|---|---|---|---|---|---|
| node-forge@1.4.0 | GHSA-86w9-cpqp-85rv | High (ignored) | `expo > @expo/cli`, `@expo/code-signing-certificates` | **No.** Dev server and update signing on a developer machine; not bundled, not on the server | None exists (A8-01) |
| braces@3.0.3 | GHSA-vfj7-8cjw-p6xm | High (ignored) | `micromatch` under metro, `@expo/metro-file-map`, jest | **No.** Build and test globbing over our own file patterns | None exists (A8-01) |
| decode-uri-component@0.2.2 | GHSA-vcc3-ghjq-m6fr | Moderate | `expo-router > query-string` | **Yes, on device** (deep links) | A8-02 |
| uuid@7.0.3 | GHSA-w5hq-g745-h8pq | Moderate | `expo > @expo/config-plugins > xcode` | **No.** Runs only at prebuild, and `xcode` calls v4 without a `buf`. The bug is in v3/v5/v6 with `buf` | Needs `xcode` to move to uuid ≥11 (latest `xcode@3.0.1` still has `^7.0.3`). Accept |
| sprintf-js@1.1.3 | GHSA-hp3w-g68c-fv3c | Moderate | `jest > … > js-yaml > argparse` | **No.** Jest config parsing of our own files | None exists (`<0.0.0`). Accept |

`--prod` lists the sprintf-js path through `expo-router > @testing-library/react-native > jest`
because `auto-install-peers=true` installs expo-router's optional testing peer. It is still test
code only and is never imported by the app.

---

## 3. Phase 4 dependency review (`git diff 17ca607..7d53bc6`)

| Package | Where | Pin | Licence | Install script | Notes |
|---|---|---|---|---|---|
| expo-notifications 57.0.21 | apps/native | exact | MIT | none | Matches `bundledNativeModules.json` (`~57.0.21`). Expo Modules API, so New Architecture native. Pulls `expo-application`, `badgin`, `abort-controller` |
| expo-image-picker 57.0.20 | apps/native | exact | MIT | none | Matches the SDK (`~57.0.20`). Pulls `expo-image-loader` 57.0.1 |
| expo-document-picker 57.0.2 | apps/native | exact | MIT | none | Matches the SDK (`~57.0.2`) |
| expo-file-system 57.0.7 | apps/native | exact | MIT | none | Already transitive through expo; now direct (gotcha 14). Matches the SDK |
| expo-splash-screen 57.0.9 | apps/native | exact | MIT | none | Matches the SDK (`~57.0.9`). Pulls `xml2js@0.6.0` (config plugin, prebuild only) |
| badgin 1.2.3 | transitive (expo-notifications) | locked | MIT | none | **One maintainer, last published 2022-04.** Web-only badge helper; on iOS and Android the native module handles badges. Expo owns this choice. Recorded in the risk register, not a finding |
| sharp 0.35.5 | packages/documents | exact | Apache-2.0 (+ libvips LGPL-3.0-or-later) | none | Already locked at Phase 3 through Next. Now a direct server dependency that decodes **untrusted uploads** (`packages/documents/src/images.ts:46`), with `limitInputPixels: 100_000_000` set. Marked `serverExternalPackages` (`apps/web/next.config.ts:49`) |
| packages/jobs | new workspace | n/a | private | none | Dev dependencies only (types, vitest, typescript, rimraf). No runtime dependency |

Workspace edges added: `db → catalogue, content, jobs, messaging`; `messaging → content, jobs`;
`web → jobs`. All are package→package or app→package. No `packages/*` imports `apps/*` (hard rule 1).

**Version pins (CLAUDE.md), all intact:** `react`/`react-dom` 19.2.3 exact in `apps/web` and
`apps/native`, one copy in the lockfile; `react-native` 0.86.2 exact; `jest ^29.7.0` resolves to
29.7.0; `jest-expo` 57.0.4 exact. For the record, the locked `expo@57.0.25` lists
`react-native 0.86.3` and `jest-expo ~57.0.5` in its `bundledNativeModules.json`, so `expo-doctor`
will report both. That gap is the documented decision in CLAUDE.md (jest-expo 57.0.5 breaks with
RN 0.86.2). **No upgrade is recommended.** Dependabot ignores all four (`dependabot.yml:27-33`).

---

## 4. Supply chain integrity

- Lockfile committed. Every CI install uses `pnpm install --frozen-lockfile` (`ci.yml:69,112,153`, `audits.yml:227`). ✅
- No git, tarball or non-registry sources in the lockfile. ✅
- Typosquats: none among direct dependencies. ✅
- Overrides: `shell-quote ^1.11.0` (critical advisory) and `source-map-js ^1.2.2` (high), both from Phase 3 and both still justified. ✅
- Install scripts: only `lefthook` (git hooks, dev). See A8-04 for the stale allowlist.
- Pinning: runtime third-party dependencies added this phase are exact. Some older runtime ranges remain caret (`next ^16.3.8`, `zod`, `drizzle-orm`, `pg`); the frozen lockfile plus Dependabot's 14-day cooldown (`dependabot.yml:19-20`) cover that.
- `packageManager: pnpm@10.33.0`; Node `24.11.1` in `.nvmrc` and in `eas.json`; CI reads `.nvmrc`. ✅
- Framework currency: Next 16.3.8 (latest 16.4.0, one minor behind); Expo SDK 57 is current and inside the store-supported window.
- Automation: Dependabot on npm and github-actions, weekly, grouped minor and patch, 14-day cooldown, SDK-coupled packages ignored. The weekly A8 scan blocks on a new High (`audits.yml:13,237-239`). ✅

## 5. Licence inventory (978 installed packages)

| Licence | Count | Obligation |
|---|---|---|
| MIT | 812 | Notice |
| Apache-2.0 | 50 | Notice, plus NOTICE file if present |
| ISC · BSD-3-Clause · BSD-2-Clause · 0BSD · MIT-0 | 39 · 22 · 11 · 2 · 2 | Notice |
| BlueOak-1.0.0 | 8 (glob, minimatch, rimraf, lru-cache…) | Permissive, notice |
| MPL-2.0 | 6 (lightningcss build, axe-core dev) | File-level copyleft, only if we modify and distribute those files. We do neither |
| Unlicense · CC0-1.0 · (MIT OR CC0) | 3 · 1 · 2 | None |
| MIT OR Apache-2.0 | 3 (biome, fb-dotslash) | Notice |
| Python-2.0 | 1 (argparse, dev) | Notice; dev only |
| CC-BY-4.0 | 1 (caniuse-lite, build data) | Attribution; build only, not shipped as content |
| (BSD-3-Clause OR GPL-2.0) | 1 (node-forge, dev CLI) | We take BSD-3-Clause |
| Apache-2.0 AND LGPL-3.0-or-later | `@img/sharp-*` / `sharp-libvips-*` | libvips is LGPL. It runs on our servers (Vercel) and is **not distributed**, so no obligation today. If a container image or binary with sharp is ever shipped to a third party, include the LGPL notice and leave libvips replaceable (it is dynamically linked) |
| Unspecified | 11 | All our own private `@universityflow/*` workspaces |

App fonts (`@expo-google-fonts/material-symbols`, MIT AND Apache-2.0) are unchanged since Phase 3.

## 6. Not measured

- **libvips/native CVEs in `@img/sharp-libvips-*`.** pnpm audit only covers the npm advisory feed and cannot see C-library CVEs. sharp is exact-pinned and Dependabot does not ignore it, so new sharp releases, which bundle libvips fixes, will be proposed. No libvips CVE feed was checked in this run.
- **Expo push and native module behaviour on a real device.** This audit only checks that the versions agree. A device run is owed separately (status.md).
- **Phase 3's 7 Medium A8 findings.** No `PHASE-3-A8.md` is committed and status.md records only A8-01 by ID, so the Phase 3 Medium IDs could not be reconciled. This run numbers from A8-02 as instructed; if Phase 3 used A8-02…A8-08, these IDs collide and should be renumbered by whoever holds that file.

## 7. Waived

None new. A8-01 stays **Accepted** (owner decision, recorded 2026-10-13 in status.md:129).
Re-checked today: still no patch for either advisory, and the reachability argument still holds.

## 8. Remediation roadmap

- **Quick wins (< 1 day):** A8-04 (trim the allowlist), A8-05 (`pnpm dedupe` and align zod), A8-03 (SHA-pin `actions/*` and the suite ref), A8-02 (`+native-intent.tsx` guard with a test).
- **At the next Expo SDK upgrade:** re-check A8-01, decode-uri-component (expo-router → query-string 9) and uuid (xcode).

## 9. What's genuinely good

- **No push SDK on the server.** `expo-push.ts` talks to exp.host with `fetch` behind the channel interface, so there is one less runtime dependency, and the stand-in and contract tests cover it.
- Every native module added this phase is a first-party Expo SDK 57 module, exact-pinned to the version the SDK bundles. That is the right way to add native code under `node-linker=hoisted`.
- sharp is exact-pinned, server-only (`serverExternalPackages`), and protected against decompression bombs (`limitInputPixels`). It also strips all metadata before the image leaves our servers.
- Accepted advisories are ignored **by exact GHSA id**, never by lowering `--audit-level`, so any new High still fails CI.
- The Dependabot setup is careful: a 14-day cooldown, grouped updates, and every CLAUDE.md pin and SDK-coupled package ignored with the reason written beside it.
- The frozen lockfile is used everywhere, the gitleaks binary is checksum-verified (`ci.yml:174-183`), and `persist-credentials: false` is set on every checkout.
