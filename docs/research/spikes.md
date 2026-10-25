# Phase 0 spikes: summary

**Written:** 2026-10-13 · **Base commit:** `254550a` · **Planning:** §16.1, §16.5, D8

Planning §16.1 checks the stack with five short proof-of-concept builds. D8 makes each one
twice: against the local stand-in now ("does our design hold?") and against the real service at
integration ("does the service behave as the stand-in claims?"). Phase 0's definition of done
(§16.5) asks for a written verdict on all five. These are those verdicts, stated as they are.

| # | Spike | Stand-in verdict | Real-service verdict | Blocking |
|---|---|---|---|---|
| 1 | [Phone sign-in with a South African SMS provider](spike-01-sms-sign-in.md) | **Holds.** Own OTP flow, limits, global budget and the live/local switch, tested from the store to the browser (E2E) | **Not started.** No provider chosen; `SMS_ADAPTERS` is empty and live mode refuses to start | Owner chooses a provider. Blocks the March 2027 launch (nobody can sign in without SMS) |
| 2 | [Round trip, Vercel `cpt1` → RDS af-south-1](spike-02-cpt1-rds-latency.md) | **Not started**, and mostly can't be locally. Nothing measures latency. Functions are now pinned to `cpt1` in code | **Not started.** Needs RDS in af-south-1 and a Vercel project | Owner's AWS and Vercel accounts. Blocks confirming the hosting choice and residency of processing |
| 3 | [Agent streaming with a tool call that renders an artifact](spike-03-agent-streaming-artifacts.md) | **Holds.** Streaming NDJSON, tool loop and artifacts tested through the route; crisis card rendered in the browser (E2E) | **Pending.** `AnthropicChatModel` written, never run, no test of its own | `ANTHROPIC_API_KEY`. Blocks A10 checks 2–8 and real chat quality |
| 4 | [Reading 10 real Grade 11 reports into confirmed marks](spike-04-reading-real-reports.md) | **Holds for the flow** (draft → confirm → results). **Proves nothing about reading**: the stand-in returns one synthetic report | **Not started.** `AnthropicReportReader` written, never run, no test of its own | `ANTHROPIC_API_KEY` and 10 consented real reports kept outside the repo. Blocks the product's first step working as designed (manual entry works today) |
| 5 | [Trigger.dev reminder three days out, then cancelled](spike-05-trigger-reminder.md) | **Not started.** No job interface, stand-in or contract; only quiet hours exist | **Not started.** Needs a Trigger.dev project and a residency decision for its workers | Nothing in the MVP (no scheduled messages before Phase 4). Blocks Phase 4 |

**Correction to status.md's phase board**, which says "spikes: 3 of 5 covered by tests, 2 need
real accounts (SMS sign-in; reading real report photos)". On the evidence: **2 of 5 hold
against their stand-in** (1 and 3), spike 4 holds for its flow but not for reading, and
**spikes 2 and 5 have not been started in either form**. All five still need their real-service
run. status.md is not edited in this change; the next session's status update should carry
this.

## Commands run

All on 2026-10-13, on branch `phase-0/spike-writeups` from `254550a`, after
`pnpm install --frozen-lockfile`:

```text
pnpm --filter @universityflow/messaging test   Tests  31 passed (31)
pnpm --filter @universityflow/db test          Tests  68 passed | 4 skipped (72)   (4 = real Postgres; TEST_DATABASE_URL unset)
pnpm --filter @universityflow/documents test   Tests  86 passed | 10 skipped (96)  (10 = real S3; TEST_S3_ENDPOINT unset)
pnpm --filter @universityflow/agent test       Tests  31 passed (31)
pnpm --filter @universityflow/evals test       Tests  4 passed (4)                 (crisis red-team, 64 cases, 100%)
pnpm --filter @universityflow/ui test          Tests  1 passed (1)
pnpm --filter @universityflow/web test         Tests  88 passed (88)
pnpm --filter @universityflow/web build && pnpm --filter @universityflow/web test:e2e
                                               4 passed (24.4s)
```

The narrower per-spike runs are in each spike's file.

## Things the write-up found

None of these is fixed here (this change is docs only); each is for a following PR or the
integration session.

1. **Functions were not pinned to `cpt1` anywhere in code.** *Fixed on this branch:*
   `apps/web/vercel.json` sets `regions: ["cpt1"]`, and production refuses to start when
   `VERCEL_REGION` names another region (tests in `apps/web/test/config.test.ts`). Spike 2.
2. **`AnthropicChatModel` and `AnthropicReportReader` have no unit tests**, not even with a
   mocked client. Every chat and reading test runs on a stand-in. Spikes 3 and 4.
3. **No job-scheduler interface or stand-in exists**, although D8 asks for one for every
   provider. Spike 5.
4. **`packages/ui`'s `ARTIFACT_KINDS` is stale**: it lacks `crisis-card`, `deadlines`,
   `application-pack` and `funding`, which the agent emits, and nothing renders from it. Spike 3.
5. **The SMS send happens after the PIN is issued**, so a provider failure still spends the
   learner's per-number PIN allowance. Spike 1.
6. **Report images up to 10 MB are sent to the AI unresized**, which may exceed the API's
   per-image limits. Spike 4.
7. During the E2E run, the minor-consent journey passed but the server logged an unhandled
   `ConsentRequiredError` ("Guardian consent is required before this student’s data can be
   processed") from a server-rendered chunk. The gate held (that is the error's job), but a page
   appears to throw it rather than redirect. Worth a look; not investigated here.

## What closes Phase 0

Phase 0's deliverable is "the five spikes done and written up", and its definition of done is
"all five spikes have a written verdict". With this change every spike has a written verdict,
so the write-up half is done. What remains before Phase 0 can be marked ✅:

- **Spike 5, stand-in:** build the `JobScheduler` interface, its in-memory stand-in and contract
  suite (no account needed). Can be done now.
- ~~**Spike 2, in code:** pin the functions to `cpt1` in the repo, with a guard.~~ Done.
- **Spikes 3 and 4, before the key:** fake-client unit tests for `AnthropicChatModel` and
  `AnthropicReportReader`. Can be done now.
- **Real-service runs (owner, D8):** spike 1 needs an SMS provider; spike 2 needs RDS in
  af-south-1 and Vercel `cpt1`; spikes 3 and 4 need `ANTHROPIC_API_KEY` (and, for 4, 10 consented
  reports kept outside the repo); spike 5 needs a Trigger.dev project and a residency decision.
  Each spike file has the steps and pass criteria.
- **status.md:** correct the phase board's spike line (above) and record these verdicts.

Under D8, the real-service half of each spike lands at integration, so a reasonable call is to
close Phase 0 once the three "can be done now" items are in and to track the five real-service
runs as integration tasks. That call is the owner's.
