# Deployment: where UniversityFlow runs

Written 2026-10-23 (deployment-readiness session). Facts from providers' pages were checked on
that date; prices and terms change, so check them again before signing up.

| File | What it answers |
|---|---|
| This file | The plan-drift note, the recommendation, and the Render staging site |
| [hosting-account.md](hosting-account.md) | Can production sit in a friend's Vercel Hobby account? |
| [costs.md](costs.md) | What each option costs, and the one recommendation |
| [launch-checklist.md](launch-checklist.md) | The owner's launch standard, item by item, with what exists in the code today |
| [production.md](production.md) | Launching the real service: the accounts, every variable, `pnpm deploy:check`, the rehearsal and the launch gates |
| [demo.md](demo.md) | Judge demo mode (`UF_DEPLOYMENT=demo`): the public demo as its own Vercel project, step by step |
| [profile-photo.md](profile-photo.md) | Switching on the learner's profile photo (`UF_PROFILE_PHOTO`) once consent v4 is live: what must be true, the one step |

## 1. Plan drift: Render, and a friend's Vercel account

**What was asked (owner, 2026-10-23):** host on Render, and, to save cost, use a friend's Vercel
account.

**What the plan says (locked decision, CLAUDE.md and planning.md §0 and §16.1):** Vercel with the
functions in Cape Town (`cpt1`), Postgres (RDS) and S3 in AWS `af-south-1`. **Student data stays
in South Africa.** Changing it is a re-plan, not a tweak.

**Why Render can't take production:** Render's regions are Oregon, Ohio and Virginia (USA),
Frankfurt (Germany) and Singapore. **None is in Africa.** The Blueprint spec accepts only `oregon`,
`ohio`, `virginia`, `frankfurt` and `singapore` as a `region`.

- https://render.com/docs/regions (checked 2026-10-23)
- https://render.com/docs/blueprint-spec (checked 2026-10-23)

So production on Render would process and store a minor's marks, reports, ID-type details and
any health disclosures outside South Africa. That's a cross-border transfer under **POPIA s72**,
for users who start as **children** (POPIA ss 34–35, planning.md §8.1). It would also break a promise already written down:
docs/store/privacy-and-data-safety.md says "Everything below is stored in South Africa (Postgres
and S3 in AWS af-south-1…)", and it lists only named processors outside the country.

**Why a friend's account can't take production either:** see [hosting-account.md](hosting-account.md).
In short, Vercel's Hobby plan is for non-commercial personal use only, Vercel's data processing
addendum covers Pro and Enterprise customers only, and the account (with the data, the keys and
the bill) would belong to someone outside Tumoolo.

### The recommendation (keeps the plan)

1. **Production stays on Vercel (`cpt1`) with RDS and S3 in AWS `af-south-1`**, in a Vercel Pro
   team and an AWS account that **Tumoolo owns**. It changes only if **the owner and the legal
   reviewer both decide otherwise, in writing**, after a POPIA s72 assessment that covers minors.
2. **Render, if the owner wants it, hosts only a STAGING site on synthetic data**, free. That is
   built: `render.yaml`, and the code's guards described below.
3. The cost difference is small: about US$39 a month plus VAT for the plan-keeping production
   setup (see [costs.md](costs.md)). Render wouldn't be meaningfully cheaper for a real
   production setup, and would move the data abroad.

## 2. What the code does today

### Production can't run on Render by accident

`readConfig` (apps/web/lib/server/config.ts) refuses to start a production build:

- **on Render:** Render sets `RENDER=true` on every service, at build and at run time
  (https://render.com/docs/environment-variables, checked 2026-10-23). If it's set, production
  refuses with "Render has no South African region". Test: `config.test.ts`, "data residency:
  production never runs on Render".
- **in a Vercel region other than `cpt1`** (A1-06): `apps/web/vercel.json` pins `regions: ["cpt1"]`,
  and a production function whose `VERCEL_REGION` isn't `cpt1` refuses. Tests: `config.test.ts`,
  "data residency: functions run in Cape Town".
- **with S3 outside `af-south-1`**, an S3 stand-in, local providers, unverified catalogue data, or
  a short `AUTH_SECRET` (existing tests).

On Render, anything that isn't a staging site refuses to start, and the E2E escape
`UF_LOCAL_PRODUCTION_BUILD=1` is ignored there as on Vercel (A5-12), so one copied variable
can't switch the production checks off.

What this doesn't catch: a production build on some other host that sets neither `RENDER` nor
`VERCEL_REGION` (a self-run server abroad). The S3 region check still holds there, but the
database's location can't be read from a URL. Keeping production on the planned Vercel project
is the control. The checklist says to confirm the RDS region by hand.

### The staging site (Render, synthetic data only)

`UF_DEPLOYMENT=staging` marks a staging site. It's a production build that may use the local
stand-ins, under rules `readConfig` enforces (tests in `config.test.ts`, "the staging deployment"):

| Rule | Why |
|---|---|
| **An access gate on every request** (A5-10): HTTP Basic against `UF_STAGING_PASSWORD` (16+ characters, any user name). Pages are checked in `proxy.ts`, every API route in `handler()`; only `/api/health` is open, for Render's probe. No password set: it refuses to start, and the gate answers 503 (fails closed) | `/dev/outbox` shows every PIN and guardian link, so without a gate anyone could sign in as anyone. Tests: `staging-gate.test.ts` |
| `UF_PROVIDERS` must be `local`; `live` refuses to start | No real SMS, AI or S3, so no data leaves for a provider |
| **No real data or keys** (A5-11): `DATABASE_URL` only `pglite:` (or unset); refuses `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `EXPO_ACCESS_TOKEN`, `UF_MESSAGING_WEBHOOK_SECRET`, `UF_SMS_PROVIDER`, `UF_JOBS_PROVIDER`, `UF_WHATSAPP_PROVIDER`, `UF_PUSH_PROVIDER`, `UF_REVIEW_*`, any `UF_S3_*`, and `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` | A dashboard variable overrides render.yaml: one value copied from production would point a test copy at the production database or the real AI |
| Never with `VERCEL_ENV=production` | Staging can't be the production deployment |
| `AUTH_SECRET` must be at least 32 random characters | It's on the internet (Render generates the value) |
| Any other `UF_DEPLOYMENT` value refuses to start | No guessing |
| A **"Staging"** banner on every page, sign-in included | Nobody takes it for the real site (`components/staging-banner.tsx`, copy in `packages/content/src/en/deploy.ts`) |
| `noindex, nofollow` | Search never sends a learner there (`app/layout.tsx`) |

`render.yaml` sets up one free web service in Frankfurt with no Render database. The data lives
in the embedded database on the service's disk, which Render wipes on every deploy, restart and
sleep (https://render.com/docs/free, checked 2026-10-23). `render-blueprint.test.ts` keeps it that
way: staging only, the stand-ins only, every variable in `.env.example`, no secret value
(`AUTH_SECRET` is `generateValue: true`; `UF_PUBLIC_URL` and `UF_STAGING_PASSWORD` are
`sync: false`), and a health path that exists.

**Known limits of the staging site (owner's call):**

- Behind the gate, its `/dev/outbox` page shows every "SMS" the stand-in sent (sign-in needs it),
  so every tester with the password can sign in as any test number. Share the password only
  with people you'd trust with the whole test copy, and change it when someone leaves.
- The mobile app can't use staging: its bearer token takes the `Authorization` header the gate
  needs.
- Render's free service sleeps after 15 idle minutes and takes about a minute to wake.
- `clientIp` (lib/server/http.ts) trusts the first `X-Forwarded-For` entry. Vercel sets that
  header itself. Whether Render's proxy overwrites it or appends to it wasn't checked, so the
  per-IP PIN limit may be easier to dodge on staging. That doesn't matter on synthetic data. It
  would matter if production ever moved hosts.
- Render doesn't copy `sync: false` variables into preview environments, so previews are off
  (`previews.generation: off`).

### Health check: `GET /api/health`

`apps/web/app/api/health/route.ts`. It answers `{"status":"ok"}` (200) when the deployment's
configuration would start, and `{"status":"unavailable"}` (503) when it wouldn't. There's no reason,
variable, version or database content in either answer (test: `health.test.ts`). **It doesn't
open the database**, on purpose:

- the host calls it every few seconds, and each call would be a database round trip;
- restarting the web service doesn't fix a database outage, so a database-checking health
  check would only cause restart loops;
- every route that reads the database is another way in.

A config check still catches the commonest bad deploy (a missing or wrong variable), and the
host then keeps the last good deploy.

### No Dockerfile

Render's native Node runtime builds the monorepo directly: Node from `.nvmrc`, pnpm through
Corepack from `packageManager`, then `pnpm --filter @universityflow/web build` and `next start`.
A Dockerfile would add a second build to keep in step with Vercel's, plus `output: 'standalone'`
and the PGlite and sharp native files to copy by hand, for no gain on staging. If production ever
needs a container host, it's worth writing then.

## 3. Setting up staging (owner, when wanted; nothing here is connected)

1. Create a Render workspace **owned by Tumoolo** (not a personal or friend's account).
2. New → Blueprint → this repository → `render.yaml`. Render creates `universityflow-staging`.
3. In the service's Environment tab, set `UF_PUBLIC_URL` to its `https://…onrender.com` address,
   and `UF_STAGING_PASSWORD` to a random value of 16 characters or more. Give it only to testers.
4. The first deploy builds from `main` once CI passes (`autoDeployTrigger: checksPass`).
5. Open the site: the browser should ask for the password (any user name). Confirm the "Staging"
   banner, then confirm `/api/health` answers `ok` without the password.
6. Never add `DATABASE_URL`, `UF_S3_*`, AWS credentials, a provider or an AI or voice key to it.
   If someone does, in the file or the dashboard, staging refuses to start and names the
   variable (A5-11), and the Blueprint test fails if it's in the file.
