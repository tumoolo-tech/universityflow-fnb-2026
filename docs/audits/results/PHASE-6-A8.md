# PHASE-6 — A8 Dependency and supply chain

**Project:** UniversityFlow · **Phase:** 6 (wave 10 audit of #115–#134) · **Date:** 2026-10-25
**Commit:** e09ad5b4 · **Audit source:** tumoOLO_Audits @ 29eafd7
**Result:** 0 Critical · 0 High · 0 Medium · 3 Low · 0 waived · 2 not measured

## Scope

`c0e1545c..e09ad5b4`: every `package.json` diff, `pnpm-lock.yaml` (packages added and removed),
the root `pnpm.overrides` and `pnpm.auditConfig` (#132), `.npmrc`, `.github/workflows/ci.yml` and
`audits.yml` (install and audit steps), the installed versions in `node_modules` after
`pnpm install --offline`, and the two `@expo/cli` files that import zod.

## Method

`pnpm audit --audit-level=high` and `pnpm audit` (full); GitHub Advisory Database GETs for every
advisory the overrides and the ignore list name; npm registry GETs for the latest `next`, `expo`,
`@expo/cli`, `firebase`, `@firebase/firestore` and `zod`; declared ranges read from the installed
packages; the lockfile diffed by package key; licences and install scripts read from each new
package's manifest.

**Health verdict.** Sound. The lockfile holds **1,174** packages (1,171 at c0e1545c: +51 keys,
−48, mostly version bumps of next, vitest, rolldown and vite). `pnpm audit --audit-level=high`
**passes** (exit 0): 2 moderate, 1 high ignored. The scope added one direct dependency (`vite`,
a dev pin in apps/web) and three transitive ones (`@grpc/proto-loader`, `@js-sdsl/ordered-map`,
and the newer `@grpc/grpc-js`), all Apache-2.0 or MIT, none with an install script. The version
pins hold.

## Vulnerabilities (full `pnpm audit`)

| Package | Version | Advisory | Severity | Reachable | Fix |
|---|---|---|---|---|---|
| uuid | <11.1.1 (via expo > @expo/config-plugins > xcode) | GHSA-w5hq-g745-h8pq | Moderate | No: build-time (iOS project generation), our code never passes a buffer | Upstream; none needed |
| decode-uri-component | ≤0.4.2 (via expo-router > query-string) | GHSA-vcc3-ghjq-m6fr | Moderate | Guarded: A8-02's `+native-intent.tsx` filter | Known (A8-02, Fixed) |
| node-forge | 1.4.0 (via @expo/cli) | GHSA-86w9-cpqp-85rv | High (ignored) | No: dev CLI only; no patch exists | Known (A8-01) |

## Findings

| ID | Audit | Severity | Location | Finding | Status | Plan |
|---|---|---|---|---|---|---|
| A8-11 | A8 | Low | package.json:49 (`@expo/cli>zod`) | The override puts zod **4.6.7** under `@expo/cli` 57.0.27, which declares `^3.25.76` (a major outside its range). GHSA-mrhx-c7xc-m3w5 has no 3.x patch, and the latest `@expo/cli` (58.1.15) still declares `^3.25.76`, so the override is still the only fix. Read: only `start/server/DevToolsPlugin.schema.js` and `createMCPDevToolsExtensionSchema.js` import zod, using `object/string/enum/array/union/literal/optional/describe/min`, which behave the same in v3 and v4; dev server only, nothing in the app | Open | Keep; name the two files and the check in the override's status note, and re-read them at each Expo upgrade (or drop the override and ignore the GHSA as build-time only, A8-01's way) |
| A8-12 | A8 | Low | package.json:50 (`@firebase/firestore>@grpc/grpc-js`); apps/web/package.json (`firebase` 12.19.0) | The web app imports only `firebase/app` and `firebase/auth` (signup-form.tsx:102-103), yet the `firebase` umbrella brings Firestore and with it gRPC (`@grpc/grpc-js`, `@grpc/proto-loader`, `@js-sdsl/ordered-map`), and an override forcing grpc-js 1.14.6 where Firestore declares `~1.9.0` (latest Firestore 4.19.0 still does). Never loaded, but it is install weight and an override to keep | Open | Depend on `@firebase/app` and `@firebase/auth` directly and remove the override (the judges' sign-up goes with the hackathon undo PR anyway) |
| A8-13 | A8 | Low | package.json:42-45 (`pnpm.auditConfig.ignoreGhsas`) | `GHSA-vfj7-8cjw-p6xm` (braces) was **withdrawn** on 2026-10-23 and no longer matches anything ("1 high ignored" is node-forge alone). A dead ignore entry hides nothing today but reads as an accepted risk that no longer exists | Open | Remove it and update A8-01's row to node-forge only |

## Overrides (#132), each re-checked

| Override | Still needed | Breaks a declared range | Notes |
|---|---|---|---|
| `@expo/cli>zod: ^4.6.7` | Yes (no zod 3.x patch; latest @expo/cli unchanged) | Yes, `^3.25.76` → 4.6.7 | A8-11: the APIs used are common to both |
| `@firebase/firestore>@grpc/grpc-js: ^1.13.6` | Yes while `firebase` is the dependency (Firestore 4.19.0 declares `~1.9.0`) | Yes, `~1.9.0` → 1.14.6 | Firestore is never imported; A8-12 removes the need |
| `shell-quote: ^1.11.0`, `source-map-js: ^1.2.2` | Before the scope | — | Not re-audited here |

The direct bumps in #132 (`next ^16.4.3`, `vite ^8.3.5` as an apps/web dev dependency to lift
`@vitejs/plugin-react`'s copy, `jsdom ^30.1.3`, `vitest`/`@vitest/coverage-v8 ^4.1.12`) are within
their packages' ranges and fix A8-05..A8-10 as recorded. `next` 16.4.3 is the latest release.

## Version pins (CLAUDE.md) intact

apps/native: `react` 19.2.3, `react-dom` 19.2.3, `react-native` 0.86.2, `jest` ^29.7.0 (29.7.0
installed), `jest-expo` 57.0.4; apps/web: `react`/`react-dom` 19.2.3. apps/native/package.json is
unchanged in the scope. Installed: react 19.2.3, react-native 0.86.2, jest 29.7.0, jest-expo 57.0.4.

## Licence inventory (new in scope)

| Package | Licence | Install script |
|---|---|---|
| @grpc/grpc-js 1.14.6, @grpc/proto-loader 0.8.1 | Apache-2.0 | none |
| @js-sdsl/ordered-map 4.4.2 | MIT | none |
| next 16.4.3, vite 8.3.5, rolldown 1.2.15, jsdom 30.1.3, undici 8.12.3, @asamuzakjp/dom-selector 10.0.5, postcss 8.5.31, nanoid 3.3.20 | MIT | none |

Apache-2.0 carries a NOTICE obligation only if we redistribute the package; we don't (server and
dev only, never in the app binary).

## Supply chain integrity

- Lockfile committed; CI and the audits workflow install with `--frozen-lockfile` (ci.yml:74, 133,
  174; audits.yml:231); `pnpm install --offline` here reproduced the tree from it.
- No git, tarball or other non-registry source in the lockfile.
- `pnpm audit --audit-level=high` blocks in audits.yml (every PR and push to main).
- `packageManager: pnpm@10.33.0` pinned; Dependabot configured (`.github/dependabot.yml`).

## Not measured

- `pnpm dedupe --check` and the five deepest chains: not run (would resolve against the network
  beyond read-only advisory lookups); the audits workflow runs dedupe as advisory.
- Maintainer counts and publish dates of direct dependencies: not re-checked for this scope (no new
  runtime direct dependency was added).

## Waived

None.

## Framework currency (notes, not findings)

Expo SDK 58 is out (`expo` 58.0.19); the app is on SDK 57 (57.0.25), still the previous SDK. The
upgrade moves every coupled pin above (react-native, jest-expo) and is a planned piece of work, not
a quick bump. `firebase` 13.1.0 is out (12.19.0 pinned): irrelevant if A8-12 is taken.

## What's genuinely good

#132 fixed every High at its source (a newer direct dependency) where one existed and used an
override only where upstream had no fix, each tied to a GHSA; the ignore list is by advisory id,
not by package; and the native pins that broke before (Jest 30, jest-expo 57.0.5) are still held.
