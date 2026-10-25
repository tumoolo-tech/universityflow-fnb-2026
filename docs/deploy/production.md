# Launching the real service (production)

Written 2026-10-23 (wave 4, the launch agent). Provider facts were not re-checked on the day:
check prices, regions and terms on each provider's own pages before signing up.

**The owner's decision (2026-10-23):** https://universityflow.vercel.app is the judge **demo** and
stays demo-only ([demo.md](demo.md)). Real learners get a **separate production deployment**: its
own Vercel project in `cpt1`, Postgres and S3 in AWS `af-south-1`, phone PIN sign-in and guardian
consent for minors. Everything for it is built and rehearsed against stand-ins (D8). The owner
connects the accounts. Even then, **it can't take real learners** until the catalogue is
verified (hard rule 3) and the consent wording has had legal review (section 7).

Student data stays in South Africa (locked decision; POPIA s72). Nothing below changes that.

## 1. Where things stand

| | State |
|---|---|
| The code for production | Built. `readConfig` (apps/web/lib/server/config.ts) refuses to start with anything missing or unsafe (section 6) |
| The rehearsal | Built: the whole journey on a production build against the stand-ins (section 5) |
| `pnpm deploy:check` | Built: says before a deploy whether the variables would start, and why not |
| The SMS company | **Not chosen.** No SMS adapter exists, so production refuses to start until one is written for the chosen company (section 3.4) |
| The job scheduler | **Not chosen.** No jobs adapter exists either (`UF_JOBS_PROVIDER`), so production refuses for that too (section 3.5) |
| The accounts | Not connected: Vercel Pro team, AWS, the SMS company, Anthropic |
| Launch gates | Open: verification, legal review, the Information Officer, A11-19 (section 7) |

## 2. Check before you deploy: `pnpm deploy:check`

It runs the app's own `readConfig` on a deployment's variables, as the host would give them to
the app, and prints each variable as **OK**, **MISSING** or **REFUSED**, with the reason. It never
prints a value (only names, and the adapter names readConfig itself mentions). It also prints the
exact `ConfigError` the deployed app would throw: the reason `/api/health` answers 503.

```bash
# The production project's variables, pulled into a file that is never committed (.env*):
npx vercel env pull --environment=production .env.production.local
pnpm deploy:check --target production --file .env.production.local
# The live demo the same way, from the demo project:
pnpm deploy:check --target demo --file .env.demo.local
# A staging site's variables (Render):
pnpm deploy:check --target staging --file .env.staging.local
```

Exit code 0 means it would start; 1 means it would refuse; 2 is a typing mistake. Delete the
pulled file after. (The flag is `--file`, not `--env-file`: pnpm takes that one for itself.)

## 3. The accounts, step by step

### 3.1 Vercel: a second project, in `cpt1`

1. In the **Tumoolo Vercel Pro team** (never Hobby, never a friend's account: see
   [hosting-account.md](hosting-account.md)), **Add New → Project** and import this repository
   again. Name it e.g. `universityflow`. The demo project stays exactly as it is.
2. Root directory `apps/web`, framework Next.js, the default pnpm install and build.
3. `apps/web/vercel.json` already pins every function to **`cpt1`** (Cape Town). Don't override
   the region in the dashboard: a function anywhere else refuses to start (A1-06).
4. **Settings → Git:** turn off automatic production deploys for `main`. Make a **Deploy Hook**
   for `main` and store its URL as the repository secret `VERCEL_DEPLOY_HOOK_URL`: then
   `.github/workflows/deploy.yml` deploys only after CI has passed.
5. Add the variables in section 4 to the project's **Production** environment.

### 3.2 AWS: Postgres (RDS) in `af-south-1`

**Why not Neon** (which the demo may use): Neon has no South African region (as last known: re-check
its region list), so a learner's marks and reports would be stored abroad. The demo holds only
made-up learners, so it may; production may not.

1. In **Tumoolo's own AWS account**, enable the **Africa (Cape Town) `af-south-1`** region (it is
   opt-in), and work in it.
2. RDS → Create database: **PostgreSQL 17**, `db.t4g.micro` to start ([costs.md](costs.md)),
   20 GB gp3, encryption at rest **on**, automated backups on (7 days or more), deletion
   protection on, **Publicly accessible: No** where the network allows it (otherwise restrict
   its security group to what Vercel needs; see the launch checklist).
3. Check in the console that the instance's region is **Africa (Cape Town)**: a URL doesn't say
   where a database is, so the app can't check it.
4. `DATABASE_URL` = `postgres://<user>:<password>@<endpoint>:5432/<database>?sslmode=require`. The
   user must be able to create tables and a role (migration 0001 creates `uf_app`): the master
   user, or one with `CREATEROLE`. The app migrates the database on its first request.
5. **TLS (A1-51, not yet tried):** RDS signs its certificates with Amazon's own RDS CA, which Node
   doesn't trust by default, and recent `pg` versions treat `sslmode=require` as "verify the
   certificate". The first connection may fail with a certificate error. Before launch, prove one
   from the production project (see A1-51 in status.md for the fix to choose).

### 3.3 AWS: S3 in `af-south-1`

The bucket, as status.md lists it:

- a name of lower-case letters, digits and hyphens, **no dots** (the browser uploads to its
  virtual-hosted address, and a dot breaks the certificate);
- **Block Public Access** on, no public ACLs;
- every object encrypted: SSE-S3, or SSE-KMS with `UF_S3_KMS_KEY_ID`;
- a **CORS** rule allowing `POST` from `UF_PUBLIC_URL` (browsers upload with signed forms);
- a **lifecycle** rule expiring objects under `<prefix>incoming-` after one day.

Credentials: an IAM user or role limited to that bucket (and the KMS key, if any). On Vercel set
`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` only if the project can't use a role; the AWS SDK
reads them, never the app's own code.

### 3.4 The SMS company

**Choose one** that sends to South African numbers, receives replies and delivery reports by
webhook, and will sign a POPIA s21 operator agreement. Say where it processes messages: the
consent wording and the privacy page must name it.

Then the code needs **an adapter for it** (a small piece of work, done the day the choice is
made): an entry in `apps/web/lib/server/sms-providers.ts` that has

- `sender(env)`: an `SmsSender` (`send({ to, body })`) that passes the SMS contract,
  `packages/messaging/src/sms.contract.ts`;
- `inbound(env)`: an `InboundVerifier` for the company's webhooks (STOP, replies, delivery
  reports at `/api/messaging/sms/inbound`) that passes `@universityflow/messaging/inbound-contract`.
  Without it the app refuses to start: every SMS says "Reply STOP" (A5-02);
- the STOP confirmation sent as a **reply** (`sendReply`, the channel contract in
  `packages/messaging/src/channel.contract.ts`).

Each runs against a fake in CI (D8), and once against the company's sandbox. Then set
`UF_SMS_PROVIDER` to the adapter's name and the company's own keys (the adapter documents them
in `.env.example`), and point the company's inbound and delivery webhooks at
`https://<your domain>/api/messaging/sms/inbound`. Set the SMS budgets from its pricing
(`UF_SMS_BUDGET_*`, `UF_SMS_REMINDER_BUDGET_*`: today's numbers are placeholders).

WhatsApp is optional at launch (`UF_WHATSAPP_PROVIDER` unset: not offered).

### 3.5 Scheduled jobs

`UF_JOBS_PROVIDER` is required in production and **no adapter exists yet**: the hosted scheduler
(Trigger.dev, spike 5) or the Postgres queue on a Vercel cron is the owner's open decision, and
where a hosted scheduler's workers run is a residency question. An adapter goes in
`apps/web/lib/server/job-providers.ts` and passes `@universityflow/jobs/contract`.

### 3.6 Anthropic

A **new API key for production only** (never the demo's), with a monthly spend limit in the
Console. Anthropic is outside South Africa: the consent wording and privacy page already name
"our AI provider"; see A11-19 in section 7.

### 3.7 The domain

Add the domain to the Vercel project, set the DNS records Vercel shows, and wait for its
certificate. `UF_PUBLIC_URL` is that address (`https://…`, no path). Production refuses to start
without it (A1-50): every guardian link and SMS link starts with it. Add it to the bucket's CORS
rule.

## 4. Every variable, and where its value comes from

From `.env.example`. **Set in Vercel → Settings → Environment Variables → Production only.**

| Variable | Production | Where the value comes from |
|---|---|---|
| `UF_PROVIDERS` | `live` | Typed |
| `AUTH_SECRET` | 48+ random characters, production's own | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `DATABASE_URL` | `postgres://…?sslmode=require` | RDS endpoint, user and password (3.2) |
| `UF_PUBLIC_URL` | `https://<domain>` | The domain (3.7) |
| `UF_S3_BUCKET` | the bucket's name | 3.3 |
| `UF_S3_REGION` | unset or `af-south-1` | Anything else is refused |
| `UF_S3_KMS_KEY_ID` | optional | KMS key id or ARN, for SSE-KMS |
| `UF_S3_PREFIX` | optional, default `documents/` | |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | only without a role | IAM, limited to the bucket |
| `UF_SMS_PROVIDER` | the adapter's name | Once the adapter exists (3.4) |
| (the SMS company's keys) | as its adapter documents | The company's dashboard |
| `UF_SMS_BUDGET_PER_HOUR` / `_PER_DAY` | from its pricing | Defaults 300 / 2000 are placeholders |
| `UF_SMS_REMINDER_BUDGET_PER_HOUR` / `_PER_DAY` | from its pricing | Defaults 1000 / 4000 |
| `UF_JOBS_PROVIDER` | the adapter's name | Once the adapter exists (3.5) |
| `ANTHROPIC_API_KEY` | production's own key | Anthropic Console (3.6) |
| `ANTHROPIC_MODEL` | optional | Default as planning.md §16.3 |
| `UF_PUSH_PROVIDER` + `EXPO_ACCESS_TOKEN` | optional: `expo` with the token | expo.dev, with enhanced push security on |
| `UF_WHATSAPP_PROVIDER`, `UF_WHATSAPP_BUDGET_*` | optional | Once chosen |
| `UF_REVIEW_PHONE`, `UF_REVIEW_PIN_HASH`, `UF_REVIEW_UNTIL` | only during a store review | docs/store/review-notes.md |

**Leave unset in production** (each is refused, or belongs to the demo or staging):
`UF_DEPLOYMENT`, `UF_CATALOGUE_PREVIEW`, `UF_CATALOGUE_E2E_FIXTURES`, `UF_LOCAL_PRODUCTION_BUILD`,
`UF_PROFILE_PHOTO`, `UF_MINDMAP_WORDS`, `UF_CV`, `UF_CV_PROVIDER`, `UF_CV_MMEREKO_CANVAS` (until
`UF_CV` may be set: section 6), every `MMEREKO_*`,
`UF_AI_PROVIDER` other than `anthropic`, `GEMINI_API_KEY`, `ELEVENLABS_*` and
`UF_ELEVENLABS_MINORS_APPROVED` (until ElevenLabs approves under-18s in writing, A11-30), every
`UF_DEMO_*`, `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_UF_MAIN_URL`, `NEXT_PUBLIC_UF_DEMO_LOGOS`,
`UF_STAGING_PASSWORD`, `UF_DEBUG_ERRORS`. Also leave **`NEXT_PUBLIC_UF_DEMO_URL`** unset: production
accepts it today and would show the judges a "Demo for judges" link (A1-52).

## 5. The rehearsal (done before the accounts exist)

The real journey on a production build, configured as section 4 but with the stand-ins:
`apps/web/e2e/production-rehearsal-env.ts` says exactly what differs:

- `UF_LOCAL_PRODUCTION_BUILD=1` and `UF_PROVIDERS=local`: the SMS company is an outbox on this
  machine, files a local folder, the AI scripted, jobs the database's own queue. A host refuses
  this (and ignores the escape, A5-12);
- the embedded database (or `UF_REHEARSAL_DATABASE_URL`, a Postgres);
- `UF_PUBLIC_URL` is `http://localhost:3102`.

Everything else is production's: no drafts, no preview switch, nothing of the demo's.
`apps/web/test/production-rehearsal.test.ts` proves the only refusal on a host is "Production
must use live providers", and that with the accounts in their place production starts.

```bash
pnpm --filter @universityflow/web build          # with no NEXT_PUBLIC_UF_DEMO_* set
pnpm --filter @universityflow/web test:e2e:production
```

It signs up by PIN, has a guardian agree through the SMS link, has an adult agree in their own
name, signs out and in, deletes the account, and checks that nothing of the demo is there.

## 6. What production refuses today, and why (nothing here may be loosened)

From `readConfig`. `pnpm deploy:check --target production` shows which apply to a project.

**Owner accounts (connect, then it starts):** `UF_PROVIDERS` must be `live`; `AUTH_SECRET` long and
random; `DATABASE_URL` a Postgres; `UF_PUBLIC_URL` an https address (A1-50); `UF_S3_BUCKET` set and
well-formed; `ANTHROPIC_API_KEY` set; `UF_SMS_PROVIDER` and `UF_JOBS_PROVIDER` set **and backed by
an adapter**. Today the SMS, jobs and WhatsApp adapter lists are empty, so `UF_PROVIDERS=live`
refuses whatever is set: "UF_SMS_PROVIDER=… has no adapter yet. Available: none". An SMS or
WhatsApp adapter without an inbound verifier is refused (A5-02); Expo push without
`EXPO_ACCESS_TOKEN` is refused (A5-03).

**Where it runs (POPIA s72):** on Render (`RENDER` set); functions outside `cpt1`; S3 outside
`af-south-1` or an S3 stand-in (`UF_S3_ENDPOINT`).

**Verification and legal gates:** `UF_CATALOGUE_PREVIEW` (unverified catalogue data, hard rule 3)
and `UF_CATALOGUE_E2E_FIXTURES`; Gemini (`UF_AI_PROVIDER=gemini`, `GEMINI_API_KEY`) until the
consent wording, the privacy page and legal review name Google; ElevenLabs without
`UF_ELEVENLABS_MINORS_APPROVED=1` (A11-30); Mmereko outside `af-south-1` (A11-35).

**Switches waiting on consent v4 / adult-v3:** `UF_PROFILE_PHOTO`, `UF_MINDMAP_WORDS` and `UF_CV`
(the CV until the live wording names Mmereko). See docs/legal/consent-v4-draft.md.

**"Open Mmereko" (`UF_CV_MMEREKO_CANVAS=1`, the owner's decision of 2026-10-24):** a button on My
CV that opens Mmereko's own site (`MMEREKO_APP_URL`, default `https://mmereko.tumoolo.tech`, an
https origin alone) in a full-screen canvas, for a learner 18 or over or at university, never an
under-18 school learner. Off by default. It needs `UF_CV=1`, so in production it waits with My
CV; it is not itself refused there, since UniversityFlow sends Mmereko nothing (no query, no
message, no prefill) and the privacy page's "Separate services" line names it. Only `/cv`'s CSP
gets `frame-src` for Mmereko's origin, and only with the switch on. `MMEREKO_APP_URL` is not one of
the partner `MMEREKO_*` settings in the list above. Before turning it on, check from the live site
that Mmereko's sign-in finishes inside the canvas (that depends on Mmereko's `frame-ancestors` and
cookies); "Open in a new tab" is always there when it doesn't.

**The demo's and staging's own:** any `UF_DEPLOYMENT` other than unset turns it into a demo or a
staging site (each refusing production's providers); every `UF_DEMO_*`, the judges' Firebase
sign-up, `NEXT_PUBLIC_UF_MAIN_URL` and `NEXT_PUBLIC_UF_DEMO_LOGOS` are refused in production.

**Format checks:** SMS and WhatsApp budgets whole numbers, hour ≤ day; a webhook secret, if set,
32+ characters; the store-review trio together, a hashed PIN, at most 31 days.

## 7. Before real learners: the launch gates

Starting is not launching. None of these is code:

1. **Catalogue verification (hard rule 3).** Production shows only verified records, and none is
   verified yet: the kit is docs/verification/. Until then, a learner sees no programmes.
2. **Legal review** of the consent wording (guardian v3, adult v2), the privacy page (its "Owner
   to fill" placeholders) and the ECTA s43 footer details (A2-65). The SMS company, AWS, Vercel
   and Anthropic named as operators, with s21 agreements (Vercel's DPA covers Pro only).
3. **The Information Officer** registered with the Information Regulator.
4. **A11-19:** whether POPIA s57 needs the Regulator's prior authorisation before children's
   information goes to Anthropic (up to 4 + 13 weeks: file by early November 2026 for March 2027).
5. The owner's launch standard ([launch-checklist.md](launch-checklist.md)): a real PIN to a real
   phone on the **live** site, a guardian link opening on the live domain, a STOP from a real
   phone, Lighthouse on the live site, the RDS region confirmed by hand.

Then: `pnpm deploy:check --target production` says it starts, `/api/health` answers 200 on the
live domain, and the section 7 items are signed off by the people who own them.
