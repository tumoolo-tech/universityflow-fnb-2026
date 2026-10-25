# Spike 2: Round-trip time, Vercel `cpt1` → RDS af-south-1

**Written:** 2026-10-13 · **Base commit:** `254550a` · **Planning:** §16.1 spike 2, §16.5, D8

| | Verdict |
|---|---|
| **Stand-in** | **Not applicable / not started.** A latency spike has no meaningful stand-in. Nothing in the repo measures latency, and nothing pins the functions to `cpt1` |
| **Real service** | **Not started.** Needs a Vercel project and an RDS instance in af-south-1 |

## The question

When a Vercel server function runs in Cape Town (`cpt1`) and talks to PostgreSQL on RDS in
af-south-1, how long does a database round trip take, and how long does a typical page or API
request that makes several queries take, warm and cold?

**Why it matters.** Planning §16.1 chose `cpt1` and af-south-1 for two reasons: "low latency for
South African students" and "processing stays in South Africa". Every page in the app makes
several queries (session lookup, consent check under row-level security, the data itself), so a
slow round trip multiplies. If the pair is slow, or Vercel doesn't actually run the functions
in `cpt1`, the stack choice needs to change before Phase 1 builds more on it (§16.1: "If a spike
fails, we swap that one piece").

## Stand-in verdict: not started (and mostly can't be)

Be precise about what exists and what doesn't:

- **The database client is ready for real Postgres.** `openDatabase` in
  [packages/db/src/client.ts](../../packages/db/src/client.ts) uses `pg`'s `Pool` (max 10) for a
  `postgres://` URL, and PGlite otherwise. The real-Postgres suite
  [packages/db/src/postgres.test.ts](../../packages/db/src/postgres.test.ts)
  (`describe.skipIf(!url)('on real Postgres')`: `migrates idempotently`, `holds a minor’s data
  behind consent, in the database itself`, `lets only the budget through when sends race on
  separate connections`, `keeps one student’s rows from another`) proves the **semantics** on
  real Postgres 17 (CI service; status.md test ledger). It does not time anything.
- **Production refuses anything but Postgres.** `readConfig`
  ([apps/web/lib/server/config.ts](../../apps/web/lib/server/config.ts)) throws `Production
  needs a Postgres DATABASE_URL`.
- **No latency measurement exists anywhere in the repo.** No benchmark script, no timing test,
  no `performance.now`, no Server-Timing header.
- **Nothing pins the functions to `cpt1`.** There is no `vercel.json`, no `regions` setting and
  no `preferredRegion` export in any route. The only mention is the job name
  `Deploy main to Vercel (cpt1)` in [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml),
  which calls a deploy hook and sets no region. Unless the region is set in the Vercel project
  settings, functions run in Vercel's default region, outside South Africa. That would break
  both the latency premise and "student data stays in South Africa" (processing, not just
  storage). **This is a gap to close at integration, not something the code proves.**

Command run on 2026-10-13 (this branch), for the parts that do exist:

```text
pnpm --filter @universityflow/db test
  Test Files  4 passed | 1 skipped (5) · Tests  68 passed | 4 skipped (72)
  (the 4 skipped are postgres.test.ts: TEST_DATABASE_URL was not set on this machine)
```

A local measurement (Docker Postgres from `pnpm db:up`) would only show localhost numbers, so it
was not done: it can't answer the question.

## Real-service verdict: not started

**Needed from the owner:** an AWS account with an RDS PostgreSQL instance in **af-south-1**
(the af-south-1 region must be enabled on the account first; it is opt-in), a Vercel project on
a plan that allows choosing the function region, the region set to **`cpt1`**, and
`DATABASE_URL` set in Vercel to the RDS endpoint with TLS (`sslmode=require`; RDS for
PostgreSQL 15 and later refuses unencrypted connections by default, and `client.ts` passes the
URL to `pg` as is, so TLS must come from the URL).

### Steps at integration

1. **Pin the region in code**, not only in the dashboard, so it can't drift: a `vercel.json`
   with `"regions": ["cpt1"]` (or `preferredRegion` on the routes). Add a test or guard that
   fails if it is removed.
2. **Confirm where functions run.** Deploy a preview and read the `x-vercel-id` response header
   on an API route: it names the edge and the function region (it must contain `cpt1`).
3. **Add a throwaway timing route** on a spike branch only (never merged): it runs
   `select 1` 50 times sequentially on one pooled connection and returns the timings as JSON,
   plus one cold-connection open. IDs and timings only; no student data (hard rule 4).
4. **Measure three things**, from the deployed preview, each 3 times at different hours:
   - **DB round trip**: the 50 `select 1` timings (report p50 and p95);
   - **Warm request**: `GET /api/results` for a seeded synthetic learner, 100 sequential
     requests from a South African connection (report p50 and p95 total time);
   - **Cold start**: the first request after 15 minutes idle (report the worst of 5).
5. **Connection limits.** With `Pool` max 10 per function instance, run 50 concurrent
   requests and watch RDS `DatabaseConnections`. If it approaches the instance's limit, plan
   RDS Proxy before launch (results day is a spike, planning §12.1 "Load and cost tests").
6. Remove the timing route; write the numbers into this file.

### Pass criteria (proposed here; planning sets no number, so the owner confirms)

- `x-vercel-id` shows `cpt1` on every sampled response.
- DB round trip **p50 ≤ 5 ms, p95 ≤ 15 ms** (same region, different AZs at worst).
- Warm `GET /api/results` **p95 ≤ 300 ms** server time.
- Cold start **≤ 3 s** to first byte.
- No connection errors under 50 concurrent requests.

## Risks and fallback

- **Region not pinned** (above): the largest risk, and the easiest to fix. Pin it in code.
- **`cpt1` capacity or plan limits.** If Vercel can't run functions in `cpt1` on the chosen
  plan, the residency decision (§16.1) is at stake, not just speed. Fallback: host the Next.js
  server in af-south-1 directly (for example a container on ECS Fargate in the same region as
  the database), keeping Vercel only if it can meet residency.
- **Connection storms from serverless.** Fallback: RDS Proxy, or a lower `Pool` max.
- **Cold starts.** The first E2E write already takes 6–9 s locally (status.md gotcha 18, mostly
  PGlite migrating). On RDS the migration doesn't run per request, but measure it.
- **If the spike fails** on latency alone: swap the database host (e.g. a managed Postgres in
  the same Cape Town region), not the schema. Drizzle and `pg` don't care where Postgres runs.
