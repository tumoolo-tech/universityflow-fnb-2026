# UniversityFlow — session context

**An AI companion from Grade 11 results to graduation.** A pnpm/Turborepo monorepo: a Next.js
web app, an Expo mobile app (iOS + Android), and the packages both are built from. Built by
TUMO OLO, the same way as the tumo-olo repo.

## Read these first

| File | When |
|---|---|
| [status.md](status.md) | **Always, first.** Where the project is right now, what's next |
| [planning.md](planning.md) | Before starting a phase. Decisions (§0), the journey (§3), the agent (§4), stack and structure (§16) |

## Locked decisions (planning.md §0)

- **First cohort** = Grade 11 in 2026. The MVP (Phases 0–3) is live for **March 2027**.
- **Universities** = Wits, UJ, UP, UCT, TUT, UKZN first.
- **Data** = public + student-provided only in v1. Never log into a university system as a student.
- **Login** = our own accounts (phone OTP / email). A student number is profile data, never a credential.
- **Platform** = web app **and** Expo mobile app in one monorepo, + WhatsApp/SMS. The app calls the
  web app's API routes; it never holds keys or calls the AI directly.
- **Hosting** = Vercel `cpt1` + Postgres and S3 in AWS af-south-1. **Student data stays in South Africa.**
- **Integration order (D8)** = build against local stand-ins behind interfaces; the owner connects
  real accounts (AI, SMS, WhatsApp, AWS, Vercel, Trigger.dev, Sentry, stores) at the end.
  Never hard-wire a provider: every one has an interface, a fake and contract tests.

## Hard rules (planning.md §16.4)

1. `packages/*` never import from `apps/*`.
2. **Admission facts come only from `packages/catalogue` and `packages/admissions`.** No
   requirement, deadline, fee or score formula in a prompt or a component. Code decides, the AI explains.
3. **Every catalogue record has `sourceUrl`, `academicYear`, `verifiedOn`, `verifiedBy`.** Unverified never reaches a student.
4. **No personal information in logs, job payloads, analytics, snapshots or fixtures.** IDs only. Fixtures synthetic.
5. **Nothing about a minor is processed before guardian consent is recorded**, enforced in the data layer.
6. **Every value read from a document is confirmed by the student** before any calculation uses it.
7. **The crisis red-team suite passes 100%** for any change to `packages/agent` or `packages/content`.
8. Every user-visible string from `packages/content`. Every design value from `packages/tokens`.
9. Every animation has a reduced-motion path. WCAG 2.2 AA throughout.
10. Every Critical/High audit finding is fixed with a test that fails without the fix.

11. **`admissions`, `catalogue`, `planner`, `content`, `tokens` and `ui` never touch `window`, `document`,
    `navigator` or Node built-ins.** They run under React Native.

Rules 1, 4, 8 and 11 are also text guards (`pnpm check`), each proven on a broken example (`pnpm check:test`).
So is gotcha 14: `apps/native` must list every workspace package it reaches.

**Agents never add `verifiedOn`/`verifiedBy`**, never mark an "Owed checks" item done, and never
weaken a guard, coverage floor or CI job to make it pass. Those are a person's calls.

## Version pins — do not "helpfully" upgrade these (same as tumo-olo)

| Package | Pin | Why |
|---|---|---|
| `react`, `react-dom` | **19.2.3 exact**, in both apps | Expo SDK 57 bundles this exact version; floating it breaks resolution under `node-linker=hoisted` |
| `react-native` | **0.86.2 exact** | Bundled by SDK 57 |
| `jest` | **29.x** | `jest-expo@57` depends on Jest 29 internals; Jest 30 fails with `clearMocksOnScope is not a function` |
| `jest-expo` | **57.0.4 exact** | 57.0.5 moved the RN Jest preset to `@react-native/jest-preset@^0.86.3`, which doesn't match the pinned RN 0.86.2 and fails with "The React Native Jest preset … has moved to a separate package" |

**RNTL v14 `render` and `fireEvent` are async.** Always `await` both, or failures point at the wrong line.

## Working cycle

`Plan → Implement → Test → Audit → Update status.md → next phase`. A phase can't close with an
open Critical/High finding, a failing or skipped suite, or a stale `status.md`.

## Commands

```bash
pnpm verify        # the gate: lint, guards, guard tests, typecheck, test, build
pnpm lint · pnpm check · pnpm check:test · pnpm test · pnpm typecheck
pnpm obligations -- --base origin/main   # what this branch owes a person or an audit (the PR comment)
pnpm db:up         # local Postgres (docker compose); db:down to stop
pnpm --filter @universityflow/web dev
pnpm --filter @universityflow/native dev   # Expo
pnpm --filter @universityflow/web test:e2e  # Playwright + axe against a production build (build first)
pnpm --filter @universityflow/tokens generate   # after changing tokens: rewrites tokens.css
TEST_DATABASE_URL=postgres://… pnpm --filter @universityflow/db test   # also run the real-Postgres suite
```

## Conventions

- Branches `phase-N/short-description`. Conventional Commits (`feat(admissions): …`).
- `main` is PR-only, squash-only, CI-gated on **Static · Unit · Build**.
- The pipeline is planning.md §12.4; audits and their IDs are [docs/audits/README.md](docs/audits/README.md).
  Findings go into status.md → Open findings as `A5-01 | A5 | High | …`, which the phase gate reads.
- Never commit `.env*`. `.env.example` documents every variable.
- Never commit a real student document. `real-samples/` folders are git-ignored.

## Environment notes

- Windows. **The Bash tool has no coreutils on PATH.** Use PowerShell or the dedicated file tools.
- PowerShell 5.1's `Set-Content -Encoding utf8` writes a BOM. Write files with the file tools or Node.
- Lessons from tumo-olo's `status.md` gotchas apply here too, especially: run E2E against a
  production build, never `next dev`; and Next 16.3's image optimizer can wedge a URL after a
  client aborts (vercel/next.js#96538). Port tumo-olo's patch the day this app first uses `next/image`.

## At the end of every session

Update [status.md](status.md): phase state, what shipped, test/audit ledgers, open findings,
next 3 actions, and bump the date at the top.
