# Spike 5: A Trigger.dev reminder scheduled three days out, and cancelled

**Written:** 2026-10-13 · **Base commit:** `254550a` · **Planning:** §16.1 spike 5, §7.2, §16.5, hard rule 4, D8

| | Verdict |
|---|---|
| **Stand-in** | **Done for the scheduler (open finding A1-08).** A `JobScheduler` interface (`packages/jobs`), two stand-ins (in memory, and a Postgres queue in `packages/db`) and a contract suite both pass, IDs-only payloads enforced in types, at runtime and in the database. **Not built yet:** the reminder itself (no reminders table, no "send reminder" job kind, no quiet-hours step before scheduling), which is Phase 4 |
| **Real service** | **Not started.** Needs a Trigger.dev project, its adapter, and a decision on where its workers run |

## The question

Can we schedule a reminder for a specific learner to fire three days from now, at a time that
respects quiet hours, carrying only IDs in its payload, and cancel it cleanly before it fires
(for example when the learner completes the task or opts out), with Trigger.dev?

**Why it matters.** Planning §16.1: "Reminders must fire reliably at the right hour, even weeks
later. Serverless functions can't do that alone." Reminders carry the application season
(deadlines, NBT, June results, NSFAS windows; planning §3) and Phase 4's messaging. A reminder
that fires after the learner has already acted, or wakes them at night before an exam, does
harm (§7.2). Cancelling matters as much as scheduling.

## Stand-in verdict: the scheduler is done; the reminder is not

*Updated 2026-10-13, branch `phase-0/job-scheduler` (open finding A1-08).*

### What exists

- **`packages/jobs`** (new, server-only; the mobile app never depends on it):
  - `JobScheduler`: `schedule({ kind, payload, runAt | delayMs, idempotencyKey?, maxAttempts? })`,
    `cancel(id)` (true only if it took a not-yet-started job off the schedule; false, never an
    error, for a job already running, finished or cancelled, or an unknown or malformed id) and
    `get(id)`.
  - `JobRunner.runDue(handlers, { limit?, onError? })`, for the stand-ins: claims due jobs one at a
    time and runs each through the handler for its kind (`handle(kind, fn)`). A hosted scheduler
    runs its own jobs and has no runner.
  - **IDs-only payloads (hard rule 4)**, enforced three ways. Types: `defineJobKind('reminder.send',
    ['reminderId'])` fixes the fields (each name must end in `Id`), and values are `EntityId`s,
    which only `entityId()` makes, after checking for a lower-case UUID; a plain string, a missing
    or an extra field is a type error (proven with `@ts-expect-error`). Runtime: every schedule,
    and again every run, checks exactly the kind's fields, each a UUID, and the error never repeats
    the value. Database: a check constraint on the Postgres queue refuses anything else, even
    written around the scheduler. Idempotency keys are restricted too (lower-case, `: . _ -`, no
    run of seven digits outside a UUID), since they are stored and shown like payloads.
  - `MemoryJobScheduler`, with an injectable clock.
  - `jobSchedulerContract` (`@universityflow/jobs/contract`), the suite every implementation runs.
- **`PostgresJobScheduler`** in `packages/db` (migration `0004_jobs`), which local development
  uses (`UF_PROVIDERS=local`): jobs survive a restart, and each due job is claimed with one atomic
  statement (`for update skip locked`) plus a lease, so racing runners never take the same job and
  a runner that dies hands the job on. The claim count is a fencing token: a stalled runner that
  finishes late records nothing over the newer claim. Times come from the clock, never `now()`.
  No error text is stored (it could quote personal data); `onError` hands it to error reporting.
- **Wired into `apps/web/lib/server/services.ts`** as `jobs` (and `jobRunner`, local only).
  `UF_PROVIDERS=live` needs `UF_JOBS_PROVIDER` naming an adapter in
  `apps/web/lib/server/job-providers.ts`, which is empty, so live mode refuses to start rather than
  fall back to the Postgres queue.
- Still, as before: **quiet hours** (`isQuietHour`, `nextSendableAt` in
  [packages/messaging/src/quiet-hours.ts](../../packages/messaging/src/quiet-hours.ts)) and an
  **SMS sender** inside the global budget (spike 1).

### What the contract proves (each stand-in, and real Postgres)

A job scheduled three days out has not run a minute before, runs at its time with its payload,
and only once; a delay counts from now; a past time runs on the next pass, earliest first; a pass
runs at most `limit` jobs. A job cancelled before it is due never runs; cancelling twice, after
the run, or with an unknown or malformed id is safe. Payloads holding a phone number, a name,
free text, an email, an ID number, an upper-case UUID, an extra or missing field, a nested value,
a number, null, an array or a class instance are refused, without the value in the message; so
are idempotency keys that could carry the same. A missing or doubled time, a negative or infinite
delay, an invalid date and attempts out of range are refused. One idempotency key makes one job,
even five schedules at the same moment, and keeps its first time; the same key for a different job
is a `JobConflictError`. A handler that throws is retried later (1, 2, 4 minutes … at most an
hour), not at once, and given up after `maxAttempts`; a kind with no handler is given up without
running. Runners racing over the same due jobs run each once. A stalled runner's job passes to
another runner after the lease (not before), and the stalled run finishing late changes nothing;
on the last attempt, the job is given up instead.

Delivery is **at least once** until a run succeeds (a runner that dies mid-job means a second
run), so a handler re-checks what it acts on before acting, as below.

```text
pnpm --filter @universityflow/jobs test      Test Files 2 passed · Tests 41 passed (the contract: 18)
pnpm --filter @universityflow/db test        Test Files 5 passed, 1 skipped · Tests 89 passed, 22 skipped (contract on PGlite: 18)
TEST_DATABASE_URL=postgres://… (Postgres 17, throwaway container)
pnpm --filter @universityflow/db test        Test Files 6 passed · Tests 111 passed (contract on Postgres 17: 18)
```

### What does not exist yet

- **The reminder**: no reminders table, no `reminder.send` job kind and handler, no opt-in/opt-out
  model, no cadence rules. That is Phase 4 (messaging and matric support, due June 2027); the
  March 2027 MVP sends no scheduled message.
- **Quiet hours before scheduling**: the reminder service (Phase 4) passes the send time through
  `nextSendableAt` before it calls `schedule`. The scheduler itself knows nothing about messages.
- **Something that calls `runDue`** locally: nothing does until a job kind exists. Then a dev
  loop, or (if the owner chooses the fallback below) a Vercel cron route.
- No `@trigger.dev/sdk` dependency, no `trigger.config.ts`, no task definitions.

## What doing it looks like

### Real service at integration

**Needed:** a Trigger.dev project and its secret key (e.g. `TRIGGER_SECRET_KEY`, added to
`.env.example`), and a residency decision: a reminder job reads learner data when it runs, so
**where Trigger.dev's workers execute matters** for "student data stays in South Africa".
Either Trigger.dev's managed cloud can run in or near af-south-1, or the job only carries an ID
and calls back into our `cpt1` API to do the work (the worker never touches the database), or
Trigger.dev is self-hosted in af-south-1. IDs-only payloads already make the second shape
possible: the worker would hold nothing but a UUID.

Steps:

1. Implement `TriggerJobScheduler` behind `JobScheduler`: `schedule` triggers a task with a delay
   (or a date) and Trigger.dev's idempotency key; `cancel` cancels the run by id; `get` maps the
   run's status. List it in `apps/web/lib/server/job-providers.ts` and set `UF_JOBS_PROVIDER`.
   Each task's body calls the same handler the stand-ins run (`handle(kind, fn)`).
2. Run `jobSchedulerContract` against it on a dev project with a harness whose clock is real,
   whose `advance` waits and whose runner waits for runs to settle (minutes, not days). Some
   cases depend on stand-in mechanics (the lease timing, `limit`); where Trigger.dev's behaviour
   differs (its own retry schedule, say), record the difference and split the suite rather than
   loosen it silently.
3. The spike itself: from a preview deployment, schedule one reminder for a synthetic test
   learner **three days out**, to the owner's test handset. Schedule a second identical one and
   **cancel it** after a day. Check the Trigger.dev dashboard shows the payload as an ID only.

**Fallback already built:** if Trigger.dev fails on residency, reliability or price, the Postgres
queue plus a Vercel cron calling `runDue` every few minutes is in `cpt1` and af-south-1 and
already passes the contract. Using it in production is the owner's decision: it would mean listing
it as a live adapter on purpose, and it gives minute-level, not second-level, timing.

### Pass criteria (proposed; the owner confirms)

- The contract suite passes on the stand-in and on Trigger.dev.
- The three-day reminder arrives once, within **5 minutes** of its scheduled time, and never
  inside quiet hours (21:00 to 07:00 SAST).
- The cancelled reminder never arrives, and its run shows as cancelled.
- Payloads in the dashboard and logs hold IDs only.
- A redeploy between scheduling and firing does not lose the job.

## Risks and fallback

- **Residency** (above) is the biggest open question, and it decides the shape of the job.
- **Cancellation races:** a cancel that lands while the job runs. The job re-checks the
  reminder's state in the database before sending, so a late cancel still holds.
- **If Trigger.dev fails the spike** (residency, reliability or price): the job interface makes
  it swappable. Fallbacks: a reminders table polled by a Vercel cron every few minutes (simple,
  in `cpt1`, enough for minute-level accuracy), or AWS EventBridge Scheduler (check it is offered in
  af-south-1) calling our API.
