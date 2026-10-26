# Judge demo mode: deploying the public demo

Written 2026-10-23 for the hackathon entry. The demo is **its own Vercel project**, separate from
production, on **made-up learners only**. Provider facts below were not re-checked on the day:
check prices, plans and regions on the providers' own pages before signing up.

## Tomorrow morning: connect the keys

Two commands, in PowerShell at the repository root. Keys never pass through a chat, a file or
the screen.

```powershell
pnpm demo:setup                                        # asks, checks, sets the values, offers a redeploy
pnpm demo:smoke -- --url https://universityflow.vercel.app   # checks the live demo end to end
```

**`pnpm demo:setup`** (scripts/deploy/demo-setup.mjs) first checks you are signed in to Vercel
(if not: `npx vercel@65.2.0 login`, then run it again). It then asks for each value below, one at
a time. **Secrets are hidden: nothing appears as you type or paste; press Enter.** Leave any
answer blank to skip it (a value set last night stays as it is). Each value is checked on this
computer before anything is sent, and three wrong tries skip it. It refuses anything a demo must
never carry (AWS/S3, SMS/WhatsApp/push providers, the review sign-in, Mmereko and the other names
in `NOT_ON_DEMO`, config.ts), before asking for its value. Then it lists the names
(never the values), asks `Set them now? Type yes`, and sets each in the `universityflow` project
(team `tumo-mogames-projects`), Production and Preview, through the Vercel CLI with the value on
its stdin. Last it offers `Redeploy the latest production deployment now? Type yes` (a few
minutes). `--dry-run` checks the answers and sends nothing; `--production-only` skips Preview.

| Prompt | What it is | Where to find it |
|---|---|---|
| `DATABASE_URL` (hidden) | The demo's Supabase database: the **transaction pooler** string, the only database URL | Supabase dashboard → the demo project → **Connect** (top bar) → **Transaction pooler** → URI: `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:6543/postgres`. Put the password in place of `[YOUR-PASSWORD]` (no brackets) and add `?sslmode=verify-full` at the end. The setup refuses the direct connection (`db.<ref>.supabase.co`, IPv6 only), the session pooler (any port but 6543), a user that isn't `postgres.<ref>`, and a string without `sslmode`. `sslmode=no-verify` (encrypted, server not verified) is accepted with a warning: it is the documented last resort, used without `DATABASE_CA_CERT`. |
| `DATABASE_CA_CERT` (shown, a public value) | The certificate the app verifies Supabase against | Supabase → Database → Settings → **SSL configuration** → **Download certificate** (`prod-ca-2021.crt`). Paste the whole file (the setup reads until the `-----END CERTIFICATE-----` line) or type the file's path, e.g. `C:\Users\…\Downloads\prod-ca-2021.crt` (quotes are fine). It is sent as one line, `\n` for each line break, which the app reads. A private key is refused. |
| `ANTHROPIC_API_KEY` (hidden) | A new Anthropic key; blank keeps last night's | console.anthropic.com → Settings → API keys → Create key. Set a monthly spend limit (Settings → Limits) |
| `UF_AI_PROVIDER` | `anthropic` or `gemini`; blank is anthropic | Your choice |
| `GEMINI_API_KEY` (hidden) | Only if the demo uses Gemini | aistudio.google.com → Get API key, on a Cloud project with billing on (never a free key: step 1 below) |
| `UF_DEMO_SIGNUP` | `firebase` turns on the judges' own sign-up | Needs the next three; all four or none |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public value | Firebase console → the demo project → **Project settings** (gear) → **General** → **Your apps** → the web app → **SDK setup and configuration** → **Config**: `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Public value | The same config: `authDomain` (`<project>.firebaseapp.com`) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Public value | The same config: `projectId` |
| `NEXT_PUBLIC_UF_MAIN_URL` | Optional: "Back to UniversityFlow" | The main site's https address |
| `UF_DEMO_AI_DAILY_CAP` | Optional daily cap on AI replies | A whole number; blank is no cap |
| any other `UF_DEMO_*` switch | Asked when `.env.example`'s judge-demo section documents it (e.g. a real-photo switch, or `UF_DEMO_PHONE_SIGNUP`: type `onscreen` for the judges' on-screen sign-up, §4b) | `.env.example` says what it does |
| `UF_CV` | `1`: My CV on the built-in stand-in (a hackathon exception, "The demo's extra features" below) | Your choice; never Mmereko |
| `UF_MINDMAP_WORDS` | `1`: learners' own words in a plan map (a hackathon exception) | Your choice |
| `ELEVENLABS_API_KEY` (hidden) | Read aloud (a hackathon exception); needs the next one | elevenlabs.io → Developers → API keys → Create; give it a credit limit |
| `ELEVENLABS_VOICE_ID` | The voice Read aloud speaks in; required with the key | elevenlabs.io → Voices → the voice → its ID |
| `ELEVENLABS_MODEL_ID` | Optional; blank is ElevenLabs' default, `eleven_multilingual_v2` | ElevenLabs' models page |

Then: `Any other variable to set? Its NAME`: for anything else; blank finishes. The ones set last
night (`UF_DEPLOYMENT`, `UF_DEMO_PROJECT`, `UF_PROVIDERS`, `UF_DEMO_DATABASE`,
`UF_CATALOGUE_PREVIEW`, `UF_PUBLIC_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_UF_DEMO_LOGOS`) are not asked.
Vercel's Supabase integration variables (`POSTGRES_URL`, `POSTGRES_PRISMA_URL`,
`POSTGRES_URL_NON_POOLING`, any `SUPABASE_*`) are refused: the app reads only `DATABASE_URL`.

**`pnpm demo:smoke -- --url https://universityflow.vercel.app`** (scripts/deploy/demo-smoke.mjs)
walks the live demo as a judge would, over plain HTTP, and prints a PASS/FAIL table (exit code 1
on any FAIL): `/api/health`; the landing page's front-door pictures and "Demo for judges"; the
`/demo` picker's six learners; **each learner starts, lands on home and is still signed in on
three more pages** (`/goals`, `/me`, `/documents`); the judges' sign-up page when it is linked;
phone PIN sign-in off (or, when the on-screen sign-up of §4b is on and `/demo` links to it: its
page renders, a random made-up 080 number gets its PIN back on screen, that PIN signs in and
`/onboarding` opens, a cellphone-looking number is refused; the account is deleted at once with
"Switch learner"); a sample profile photo kept, and a real photo refused; a sample report
read; one chat reply; sign out. Five learners' copies are deleted as it goes ("Switch learner");
the last one is signed out and swept after 24 hours. Add flags to require what you switched on:
`--logos`, `--signup`, `--real-ai`, `--real-photos` (if that switch is on), `--phone-signup`
(if `UF_DEMO_PHONE_SIGNUP=onscreen`), `--cv`, `--plan-words`, `--read-aloud` (the extra
features below), and `--browser` to repeat the walk in Chromium at 360 px (Playwright from
apps/web). Without their flags, My CV and the plan-map words are checked when on and reported as
off otherwise, and Read aloud is reported on or off, like the AI line.

**If a check fails:**

- `/api/health` 503 (the table says so): the demo refused its configuration. Run
  `pnpm deploy:check --target demo` (the launch work's checker) to see which variable, fix it in
  Vercel → universityflow → Settings → Environment Variables, and redeploy.
- "signed out at /me" (or another page) for the learners: the servers don't share a database.
  Check `DATABASE_URL` is the transaction pooler string and `UF_DEMO_DATABASE=synthetic`, then
  redeploy.
- "the copy could not be made (the database?)": the database is unreachable, its password is
  wrong, or TLS failed. Vercel → the demo project → Logs, find `services could not start (…)`, and
  follow the table under "The demo's database: Supabase" (step 2 below): `SELF_SIGNED_CERT_IN_CHAIN`
  means `DATABASE_CA_CERT` is missing; `28P01` a wrong password; `UF_LEARNER_ROLE` the role step.
  Then run `pnpm demo:setup` again with the right value.
- the chat fails or `--real-ai` fails: the AI key is missing, wrong or out of credit.
- sign-up page fails with `--signup`: the four sign-up values are not all set, or there was no
  redeploy after setting them. Add the demo's domain to Firebase → Authentication → Settings →
  Authorized domains as well.
- `pnpm demo:setup` says a value was "FAILED": set that one by hand in the Vercel dashboard
  (Settings → Environment Variables), then redeploy (Deployments → the latest → Redeploy).

## What a judge gets

- One public URL. `/` is the **real landing page** (the same front page production shows), with a
  **"Demo for judges"** entry that opens the picker at **`/demo`**: **"Try UniversityFlow as…"**
  with six made-up learners: Grade 10, 11 and 12, and a first, second and final year at UJ, Wits
  and UCT. The landing page's own "Get started" and "Sign in" go to the judges' real sign-up when
  it is on (below), else to the picker. `/sign-in` offers the picker and, when on, the sign-up.
- One press makes a **private copy** of that learner for this browser, signs it in and opens
  `/home`. Everything is editable; nobody else sees the copy. **"Switch learner"** in the banner
  deletes the copy and goes back to the picker. **"Back to UniversityFlow"** beside it goes to the
  main site's landing page (`NEXT_PUBLIC_UF_MAIN_URL`) or, unset, the demo's own `/`, and keeps
  the copy for its 24 hours (the landing page then offers "Back to your learner"). Every copy is deleted **24 hours** after it was
  made (a lazy sweep on each new start, and the scheduled sweep below, which runs whether or not
  anyone visits).
- The banner on every page: "Demo: made-up learners. Don't type real personal details."
- **No phone, no PIN, no SMS.** `request-pin`, `verify-pin`, `/dev/outbox`, the dev job runner and
  the guardian SMS all answer 404. The minors' guardian consent is a recorded synthetic one.
  The one exception is the judges' on-screen sign-up (§4b, `UF_DEMO_PHONE_SIGNUP=onscreen`, a
  hackathon exception): then `request-pin`, `verify-pin` and the guardian request take made-up
  080 numbers only and send nothing, the PIN and the guardian's link shown on screen instead.
  `/dev/outbox` and the job runner stay 404 either way.
- **The real AI** in the chat (the crisis check, care, every safety rule and "Report this reply"
  stay on). An optional daily cap (below); no per-judge message cap (owner's choice).
- **Uploads take only the results generator's SAMPLE statements**: a PDF whose text layer prints
  "SAMPLE: not an official document" and whose producer is the generator. Anything else, a photo
  included, is refused before it is stored or read. "Use a sample report" on the documents page
  attaches one for the learner's grade.
- **A profile photo from made-up SAMPLE pictures only** (owner's decision, 2026-10-23), on in
  every demo with no variable to set. On About me → "Make it yours", "Choose a sample photo"
  offers six drawn pictures as radio buttons in place of a file input; the chosen one is cropped
  and zoomed as a real photo is, and `POST /api/me/photo` takes only its id and the crop. Any file
  is refused with the demo's sentence (`demo-sample-photo-only`), a body larger than 4 KB before
  it is read, so no real photo is ever received. The kept picture is stored like any photo and
  deleted with the judge's copy (the 24-hour sweep or "Switch learner").
  **How the pictures are made:** packages/documents `sample-photos.ts` draws each in code as an
  SVG of flat shapes (a coloured ground, a body, a head, hair, one detail such as glasses or a
  cap): an illustration of nobody, never a photograph and never an AI-made face. Each carries a
  dark plate with "SAMPLE" in its bottom-right corner, drawn as lines so it needs no font, and the
  plate is stamped again after the crop so no crop can remove it. `sharp` renders them when asked:
  `GET /api/demo/sample-photos/<id>` (demo only) serves the colour picture to the picker, and
  the kept one goes through the upload pipeline (512 × 512, black and white, no metadata). Nothing
  is committed as an image file. `UF_PROFILE_PHOTO` stays refused on a demo: it means real uploads.
- The draft catalogue, labelled "Draft" (`UF_CATALOGUE_PREVIEW=1`).
- Never indexed by search engines.

## Why it is safe to be public

`readConfig` (apps/web/lib/server/config.ts, `checkDemo`) refuses to start a demo that:

- uses live providers (`UF_PROVIDERS=live`);
- carries anything the production project is made of: any `UF_S3_*`, AWS credentials, an SMS,
  WhatsApp, push or jobs provider, `EXPO_ACCESS_TOKEN`, `UF_ELEVENLABS_MINORS_APPROVED`, Mmereko
  (`UF_CV_PROVIDER`, any `MMEREKO_*`: D14), the store-review sign-in, the webhook secret,
  `UF_PROFILE_PHOTO`, `UF_STAGING_PASSWORD` or `UF_CATALOGUE_E2E_FIXTURES`. (`UF_CV=1`,
  `UF_MINDMAP_WORDS=1` and ElevenLabs' key and voice are allowed since 2026-10-24: hackathon
  exceptions, "The demo's extra features" below.);
- lacks `UF_DEMO_PROJECT=1` (so the production project can't become a demo by one variable);
- points at a Postgres without `UF_DEMO_DATABASE=synthetic`;
- has a short or missing `AUTH_SECRET`.

And production and staging refuse to start with any `UF_DEMO_*` variable set, so a demo setting
copied into the wrong project stops it rather than changing it. Sessions without a PIN and the
sweep exist only on a store built for a demo (`Store` option `demo`, packages/db).

## Step by step

### 1. The AI keys, with spend limits

1. In the Anthropic Console, make a **new API key just for the demo** (never production's).
2. **Set a monthly spend limit on it** in the console (Settings → Limits). This is the real cap on
   cost: the app does not cap judges' messages.
3. If the demo uses Gemini (`UF_AI_PROVIDER=gemini`, another agent's adapter), make a separate
   Gemini key and set a budget/spend limit on its Google Cloud project the same way.
   **The key's project must have Cloud Billing on (the Paid tier), never a free key** (audit
   S1-A10b, A10-50): on the free tier Google may use what judges type to improve its products and
   human reviewers may read it ("Gemini API Additional Terms of Service", checked 2026-10-23).
   Those terms also require users to be 18 or older and forbid a service "likely to be accessed by
   individuals under the age of 18": see A10-46 before the demo URL is shared beyond the judges.

### 2. A database for the demo (recommended: Postgres)

On Vercel, each function instance has its own `/tmp`, so neither the embedded database nor files
kept on disk there are shared: a judge could be signed out between requests, and a sample report
or sample photo stored by one instance would be missing on the next. Use a Postgres made for the
demo. It holds the demo's files too:

- **How files are kept.** A demo whose `DATABASE_URL` is Postgres keeps every file (the sample
  reports, the kept sample photo) in that database, in the table `stored_files` (migration 0033,
  `PostgresFileStore` in packages/db), so every instance sees them. There is nothing to set: it
  follows from `UF_DEPLOYMENT=demo` and a `postgres://` URL. A row is the app's own key, the
  file's media type and its bytes, at most 10 MiB (the upload limit, held by the database too);
  no name, no learner id. Only the server's own role reads it (row-level security, no grant to
  the learner role), and nothing about a file is logged.
- **When files go.** With the judge's copy ("Switch learner", or the 24-hour sweep on a later
  start), with "Delete my account", and when a document or photo is removed: each returns its
  keys and the row is deleted.
- Production never uses this table: it keeps files in S3 only and refuses to start if asked to
  keep them in the database. Staging, local development and a demo on the embedded database
  (`pglite:`, e.g. run locally) keep the folder.

#### The demo's database: Supabase (the owner's decision of 2026-10-23)

**For the judge demo only.** Supabase has no South African region, so this database is outside
South Africa. That is acceptable only because it holds made-up learners (`UF_DEMO_DATABASE=synthetic`).
Real learners' data stays in South Africa on RDS in af-south-1 (a locked decision); production never
uses Supabase. (With the judges' real sign-up on, judges' emails go there too: see "Hackathon
exceptions".)

What the app needs from it, proven on 2026-10-24 against Postgres 17 behind PgBouncer in
transaction and in session mode, as a user that is not a superuser, as Supabase's isn't (the
gated suites: packages/db `postgres.test.ts`, apps/web `api-demo-postgres.test.ts`, with
`TEST_DATABASE_URL`). Not yet tried against a real Supabase project:

- **The transaction pooler** (Supavisor, port **6543**). Vercel's functions reach only IPv4, and
  Supabase's direct address (`db.<ref>.supabase.co`) is IPv6-only on the free plan. The session
  pooler (port 5432 on the pooler host) works too, but gives each open connection a server
  connection of its own, and a handful of function instances use up the free plan's small pool.
  The app is built for the transaction pooler: every request is a transaction, settings are
  `set local`/`set_config(…, true)`, locks are `pg_advisory_xact_lock`, jobs use `for update skip
  locked`, no LISTEN, no named prepared statements.
- **One URL, no "direct" second one.** Each function instance migrates the database as it starts.
  That is safe when several start at once, through the pooler too (each migration's own row goes in
  first and a second instance waits on it).
- **TLS, verified against Supabase's own CA.** Node doesn't trust Supabase's root certificate,
  and node-postgres treats `sslmode=require` as "verify against Node's", so the copied string alone
  fails with `SELF_SIGNED_CERT_IN_CHAIN`. Give the app the certificate in `DATABASE_CA_CERT`. A demo
  refuses a Postgres across the internet without TLS.
- **A small pool per instance**: 10 connections, let go after 30 s idle, and a 15 s limit to connect
  (`DEMO_DATABASE_POOL` in config.ts). Ten and 30 s since the slow start of 2026-10-25 (below).
- **The learner role and Supabase's API roles: migration 0038, nothing to run by hand.** On
  Postgres 16 and later, Supabase's `postgres` user creates the role the app drops to for every
  learner request (`uf_app`) without the right to switch to it; 0038 gives it that right. 0038
  also takes back everything Supabase grants its Data API roles (`anon`, `authenticated`) on the
  app's tables, sequences and functions, now and for later migrations, and turns row-level
  security on for the two tables that had none. Proven on a fresh Postgres 17 cluster set up like
  a new Supabase project (owner not a superuser, the API roles and their default grants), through
  the transaction pooler: 507 of 507 db tests, no grant by hand. If the app still can't use the
  role, it refuses to start and the log line says `services could not start (Error UF_LEARNER_ROLE)`.
- **Space.** An empty migrated database is about 9 MB. A judge's copy with a sample report and a
  sample photo is about 33 KB (measured: 30 copies, 60 files, 0.4 MB of files). The free plan's
  500 MB holds about 15,000 copies at once. Copies go after 24 hours (the lazy sweep, which
  deletes their rows and files), and 120 starts an hour per address bounds the growth.
- **Speed: where the time goes (measured 2026-10-25).** The functions run in Cape Town (`cpt1`,
  vercel.json) and the database is in London, about **160 ms per round trip**, and the app talks
  to the database one statement at a time. Live, before the fix: pages without the database
  (landing, picker, guide, health) 0.2–0.8 s; **a learner's start 18–40 s** (116–279 round trips,
  one after another); the first home 4–9 s. Fixed in code: acting as a learner costs one round trip
  fewer per request (`actAsLearner`), a copy's independent writes go at the same time, the sweep
  runs while the copy is made, the home reads each university's checklist at once, and the pool
  is 10 connections kept 30 s. With 160 ms simulated per round trip on a local Postgres 17: starts
  17.5 / 45.5 / 41.5 s → **11.0 / 12.1 / 13.7 s** (Grade 10 / Grade 12 / first year), the home
  2.2–5.4 s → 1.1–4.0 s. The press now says at once that the copy is being made. What is left is
  about 60 round trips that must follow each other (the account, then consent, then the rest).
  **The rest is the distance:** with the functions beside the database (simulated at 2 ms), a start
  takes about 1.2 s and the home under 0.4 s. That needs the demo's functions in London (`lhr1`),
  the owner's decision (see status.md, owner steps): `cpt1` is a locked decision for production.

Steps (the owner, on the day):

1. **Create the project.** At [supabase.com](https://supabase.com/dashboard) → **New project**:
   - Name `universityflow-demo`, in an organisation used for nothing else.
   - **Database password:** generate one and keep it in the password manager. Use letters and
     digits only, so it can go into a URL as it is.
   - **Region: the nearest to Cape Town. Supabase has none in Africa, so choose West EU (London),
     `eu-west-2`** (Central EU, Frankfurt, is the alternative). Every query crosses that distance:
     about 160 ms a round trip from `cpt1`, measured on 2026-10-25 (see "Speed" above).
   - Plan: Free.
   - If the form offers **Security options → "Only connection string"** (no Data API), choose it.
2. **Turn the Data API off.** Project Settings → **Data API** (on some dashboards Integrations →
   Data API) → **Enable Data API: off**. The app never uses it. Migration 0038 already takes back
   every grant Supabase gives its public `anon` key on our tables; off as well is belt and braces.
   Also Database → Settings → **SSL configuration → Enforce SSL on incoming connections: on**.
3. **Download the CA certificate**: Database → Settings → SSL configuration → **Download
   certificate** (`prod-ca-2021.crt` or similar).
4. **Copy the transaction pooler string**: the project's **Connect** button → **Transaction
   pooler**. It looks like
   `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`.
   Put the password in place of `[YOUR-PASSWORD]` (no brackets) and add `?sslmode=verify-full` at
   the end.
5. **In the demo's Vercel project** (Settings → Environment Variables, Production), set:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the string from step 4, ending `:6543/postgres?sslmode=verify-full` |
   | `DATABASE_CA_CERT` | the whole certificate file from step 3, `-----BEGIN CERTIFICATE-----` to `-----END CERTIFICATE-----` (paste as it is; Vercel keeps the line breaks) |
   | `UF_DEMO_DATABASE` | `synthetic` |

   **Don't install Vercel's Supabase integration.** It sets `POSTGRES_URL`, `POSTGRES_PRISMA_URL`,
   `POSTGRES_URL_NON_POOLING` and `SUPABASE_*` keys, never `DATABASE_URL`, and puts Supabase's
   service-role key into the project. A demo with those and no `DATABASE_URL` refuses to start
   (rather than quietly use a database per instance in `/tmp`, which signed judges out on
   2026-10-23).
6. **Redeploy** (Deployments → the latest → Redeploy). Nothing to run in Supabase's SQL editor:
   the first request migrates the database, 0038 included.

**After deploy, check:**

- `/api/health` answers 200. It never opens the database; the next checks do.
- `/demo` → pick a learner → `/home` opens. Reload a few times and open three or four pages: still
  signed in (each request may land on another instance; they share the database now).
- "Use a sample report" on the documents page: read, and the confirm step opens. Reload: the report
  is still there.
- In Supabase → Table Editor (or SQL: `select count(*) from uf_migrations;`): the app's tables are
  there and `uf_migrations` has one row per migration.
- `select grantee, count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated') group by 1;`
  returns no rows (0038 took them back), and `select pg_has_role('uf_app', 'SET');` says true.

**If a page fails**, Vercel → the demo project → Logs, and look for `services could not start (…)`:

| The line ends | Means | Fix |
|---|---|---|
| `UF_LEARNER_ROLE)` | 0038 couldn't give the database user the learner role (only if another user made `uf_app` first) | in the SQL editor: `grant uf_app to postgres with set true;`, then redeploy |
| `SELF_SIGNED_CERT_IN_CHAIN)` or `UNABLE_TO_VERIFY_LEAF_SIGNATURE)` | `DATABASE_CA_CERT` is missing or isn't Supabase's | paste the certificate from step 3 again |
| `ERR_TLS_CERT_ALTNAME_INVALID)` | Supabase's certificate doesn't name the pooler's host (not checked before the day) | last resort, for made-up learners only: remove `DATABASE_CA_CERT` and end the URL with `?sslmode=no-verify` (encrypted, but the server isn't verified) |
| `28P01)` | wrong password | copy the string again; percent-encode any symbol in the password |
| `ENOTFOUND)` / `ETIMEDOUT)` | wrong host, or the project is paused | check the string; free projects pause after a week unused: Supabase → Restore |
| `ConfigError)` | a variable the demo refuses | `/api/health` answers 503 too; see "Why it is safe to be public" |

The earlier choice, Neon or any other Postgres, works the same way: its pooled string,
`?sslmode=verify-full`, and `DATABASE_CA_CERT` only if its certificate isn't publicly trusted.

### 3. The Vercel project

1. In the Tumoolo Vercel team, **Add New → Project**, import this repository again, and name it
   e.g. `universityflow-demo`. It is a second project: production's project, domain and variables
   stay untouched. (Vercel's Hobby plan is for non-commercial use, so keep it in the team that
   owns production, as docs/deploy/hosting-account.md explains.)
2. Root directory: `apps/web`. Framework: Next.js. Install and build: the defaults (pnpm).
3. `apps/web/vercel.json` pins the functions to `cpt1`, as for production.
4. **Environment variables** (Production environment of the demo project):

   | Variable | Value |
   |---|---|
   | `UF_DEPLOYMENT` | `demo` |
   | `UF_DEMO_PROJECT` | `1` |
   | `UF_PROVIDERS` | `local` |
   | `AUTH_SECRET` | 48+ random characters (a new one, never production's) |
   | `DATABASE_URL` | Supabase's transaction pooler string, ending `:6543/postgres?sslmode=verify-full` (step 2) |
   | `DATABASE_CA_CERT` | Supabase's CA certificate (step 2) |
   | `UF_DEMO_DATABASE` | `synthetic` |
   | `UF_CATALOGUE_PREVIEW` | `1` |
   | `UF_PUBLIC_URL` | the demo's URL, e.g. `https://universityflow-demo.vercel.app` |
   | `ANTHROPIC_API_KEY` | the demo key from step 1 |
   | `ANTHROPIC_MODEL` | optional; the default is production's |
   | `GEMINI_API_KEY`, `UF_AI_PROVIDER` | only if the demo uses Gemini |
   | `UF_DEMO_AI_DAILY_CAP` | optional; unset means no cap (below) |
   | `NEXT_PUBLIC_UF_DEMO_LOGOS` | `1` to show the universities' logos (below); read at build time, so redeploy after changing it |
   | `UF_DEMO_REAL_PHOTOS` | `1` to let a visitor upload their own profile photo beside the samples (a hackathon exception, below); read when the server starts |
   | `UF_DEMO_PHONE_SIGNUP` | `onscreen` to let judges sign up as a new learner on made-up 080 numbers, the PIN shown on screen (a hackathon exception, §4b); read when the server starts |
   | `CRON_SECRET` | 32+ random characters, marked **Sensitive**: the scheduled sweep's secret (§7 below). Unset, only the lazy sweep runs and the cron's calls answer 503 |

   Set nothing else (but the extra features below, if you want them). In particular no
   `UF_S3_*`, no AWS keys, no SMS/WhatsApp/push/jobs provider, no `UF_CV_PROVIDER` or
   `MMEREKO_*`, no `UF_REVIEW_*`: the demo refuses to start with any of them, and `/api/health`
   answers 503 until they are removed.
5. Deploy. Open `/api/health` (200 means the configuration was accepted), then `/`.
   On 503, open the project's **Logs** in Vercel: each refused request logs one line,
   `request failed: ConfigError: <why>`, naming the variable to fix (names only, never values).
   Meanwhile the picker tells judges "The demo isn't set up yet" instead of an error.

### 4. The judges' real sign-up (optional; a hackathon exception, below)

Off unless set. To let adult judges sign in with their own account:

1. In the [Firebase console](https://console.firebase.google.com/), **create a project** for the
   demo only (e.g. `universityflow-demo`). Google Analytics is not needed: leave it off.
2. **Build → Authentication → Get started → Sign-in method**: enable **Email/Password** with
   **Email link (passwordless sign-in)** turned on, and enable **Google** (pick a support email).
3. **Authentication → Settings → Authorized domains**: add the demo's domain
   (`universityflow.vercel.app`, or whatever the demo project's URL is) and keep `localhost`.
4. **Project settings → General → Your apps → Add app → Web** (no Hosting). Copy three values
   from its config: `apiKey`, `authDomain` and `projectId`.
5. In the demo's Vercel project (Production environment), add:

   | Variable | Value |
   |---|---|
   | `UF_DEMO_SIGNUP` | `firebase` |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | the `apiKey` |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | the `authDomain` (e.g. `universityflow-demo.firebaseapp.com`) |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | the `projectId` |

6. **Redeploy** (the values are read when the server starts). `/api/health` must answer 200;
   then `/demo/sign-up` shows the notice, the email link and "Continue with Google".

No service-account key is needed: the server checks each sign-in itself against Google's
published keys. Production and staging refuse all four variables.

### 4b. Judges sign up as a new learner, on made-up details (optional; a hackathon exception)

Off unless set. The owner's decision of 2026-10-24: judges see the **real learner sign-up** from
the start (phone number → PIN → date of birth → consent → onboarding → the real learner's home and
every page a learner has), on made-up details.

1. In the demo's Vercel project (Production environment), add `UF_DEMO_PHONE_SIGNUP` = `onscreen`
   (or answer `onscreen` when `pnpm demo:setup` asks for it).
2. **Redeploy.** `/api/health` must answer 200; `/demo`, the landing page and `/sign-in` then show
   "Sign up as a new learner (made-up details)", which opens `/demo/new-learner`.
3. Check it: `pnpm demo:smoke -- --url https://universityflow.vercel.app --phone-signup`.

What a judge gets, and what keeps real people out:

- **The page says first** that this is the judges' demo: made-up details only, a made-up number
  starting with 080 (never a cellphone), nothing is sent (the PIN, and an under-18's guardian link,
  are shown on screen), and the account is deleted after 24 hours. Onboarding repeats it in one line.
- **080 numbers only.** South African toll-free numbers are never anyone's cellphone, so no real
  person can be messaged or signed up by their number. Any other number, the learner's or the
  guardian's, is refused with "use a made-up number that starts with 080". Only a store built for a
  demo accepts an 080 number at all (packages/db `normaliseTollFree`); production and staging take
  cellphone numbers only, as before.
- **No SMS.** `POST /api/auth/request-pin` returns the PIN to the screen that asked (`demoPin`),
  never sends it and never logs it; a minor's `POST /api/me/guardian` returns the consent link's
  path (`demoConsentLink`) for the screen, and the judge opens it and agrees as the made-up
  guardian on the real consent page. Nothing about the minor is processed before that yes (hard
  rule 5, enforced in the database as everywhere).
- **One account per number, for the browser that made it.** Judges pick easy numbers
  (0800 000 000), so two would otherwise land in one account and see each other's details. A
  number that already has an account gets a PIN (and signs in) only in the browser that made it:
  that browser holds an httpOnly cookie (`uf_demo_phone`, path `/api/auth`, 24 hours) with a keyed
  hash of the number (HMAC-SHA256 under `AUTH_SECRET`, its own label), never the number. Anyone
  else gets 409 and "Someone has already signed up with that made-up number. Pick another made-up
  number that starts with 080."
- **The limits:** **100 PIN requests an hour per address** with the switch on (the owner's
  approval of 2026-10-24, a hackathon exception: a judging room shares one address;
  `DEMO_OTP_PER_IP_PER_HOUR`, a demo store built with `demoPhoneSignup` only). Everywhere else,
  and on a demo with the switch off, it stays 10 (`OTP_PER_IP_PER_HOUR`). Unchanged: 3 a
  quarter-hour and one a minute per number, five wrong PINs, 3 guardian requests a day per learner.
- **Deleted after 24 hours.** Each account is an ordinary demo learner: the same sweep that
  deletes the made-up learners' copies 24 hours after they were made deletes it, with everything
  in it (the lazy one on every demo start, every PIN request and every judge's own sign-in, and
  the scheduled one of §7, daily, whether or not anyone visits), and its sessions end at 24 hours
  even before the sweep runs. "Switch learner" deletes it at once.
  No new table or marker: on a demo, every learner but a judge's own (Firebase) account is swept.
- **Off restores the demo exactly**: unset, the PIN routes and the guardian request answer 404,
  and no page links to the sign-up (`demo:smoke` checks the 404; the demo E2E runs both ways).

Production and staging refuse `UF_DEMO_PHONE_SIGNUP` like every demo switch.

### 5. The switch between the main site and the demo (optional)

- On the **main site's** project: `NEXT_PUBLIC_UF_DEMO_URL` = the demo's https URL. Its landing
  page then shows "Demo for judges", a plain link to the demo (no session or data goes across).
  Unset, the main site is unchanged.
- On the **demo's** project: `NEXT_PUBLIC_UF_MAIN_URL` = the main site's https URL, for "Back to
  UniversityFlow". Unset, that link goes to the demo's own landing page. Demo only.

Redeploy after setting either.

### 6. Check it as a judge would

- On a phone (360 px): `/` is the landing page; "Demo for judges" opens `/demo`; pick each of
  the six learners; each lands on its home with the banner; "Switch learner" goes back to the
  picker; "Back to UniversityFlow" goes to the landing page.
- `/sign-in` offers the picker (and the sign-up when on) and no phone field;
  `/api/auth/request-pin` answers 404.
- With the sign-up on: sign up with an email link and with Google, give an adult date of birth,
  and reach the adult agreement; a date of birth under 18 is refused and the account deleted.
- Upload any ordinary PDF or photo: refused with the demo's sentence. "Use a sample report":
  read, and the confirm step opens.
- About me → "Make it yours": "Choose a sample photo" shows six pictures marked SAMPLE and no
  file button; choose one, "Use this photo", zoom, Save: the card shows it in black and white,
  still marked SAMPLE. With `UF_DEMO_REAL_PHOTOS=1`: "Or use your own photo" below the samples,
  with its line; choose a JPEG, Save: the card shows it in black and white; "Switch learner" and
  the new copy shows no photo.
- Send a chat message; the reply is the real AI (no "sample" note).
- With `UF_DEMO_PHONE_SIGNUP=onscreen`: "Sign up as a new learner (made-up details)" on `/`,
  `/demo` and `/sign-in`; a cellphone number is refused; a made-up 080 number shows its PIN on
  screen; an adult date of birth reaches the adult agreement, then the profile and the home; an
  under-18's guardian (an 080 number) gets no SMS, the link shows on screen, and after "I agree"
  there, "Continue" on the waiting step reaches the profile and the home. The same 080 number in
  another browser is refused as taken.

### 7. The scheduled sweep (A11-61; the owner's decision of 2026-10-25)

The demo's words promise that a made-up learner's copy (and an on-screen sign-up account) is
"deleted within 24 hours" and a judge's own sign-up account "after 30 days". Until 2026-10-25 only
a **lazy** sweep kept them: it ran when someone started a learner, asked for a PIN or signed in, so
once visits stopped nothing was deleted. The owner chose to keep the words and make them true
when visits stop. So `apps/web/vercel.json` carries a **Vercel cron** that calls
`GET /api/demo/sweep` on the demo, which runs, bounded and idempotent, with counts only in its
answer and its log line (never an id, a number or an email):

- the copies made more than 24 hours ago, with their files (the lazy sweep's own
  `sweepDemoStudents`, batches of 50, at most 10 batches a run);
- the judges' sign-up accounts made more than 30 days ago (`sweepDemoSignups`, the same bounds);
- the files whose storage delete failed in their request (A1-88's queue: a demo has no job runner
  to retry them);
- D10's module marks and outlines past their keep-until date (A11-60; none on a demo before 2028,
  run so that the schedule exists), and the expired sessions (A11-03's daily sweep, which on a demo
  nothing else runs).

**What holds it in.** The route exists only on a demo (`requireDemo`: 404 anywhere else, before
the secret is looked at). It takes Vercel's own `Authorization: Bearer <CRON_SECRET>`, compared in
constant time over fixed-length digests (apps/web/lib/server/demo/sweep.ts); anything else is 401.
`CRON_SECRET` is a demo switch like every `UF_DEMO_*`: **production and staging refuse to start
with it set**, a demo refuses one shorter than 32 characters, and a demo without it starts as
before (the cron's calls then answer 503 and the log names the variable). A run keeps to a 40 s
budget inside the route's 60 s; a backlog is finished by the next runs. Vercel may call a cron
twice or miss one: both are safe. The lazy sweep stays as it was. The cron entry is shared with
production's `vercel.json`, where the route answers 404 (and production refuses the secret): the
undo PR removes both (hackathon-undo-pr.md M).

**The owner's console steps (once):**

1. Make a secret: 32 or more random letters and digits from a password generator, kept nowhere
   else.
2. **Vercel → the demo project (`universityflow`, team `tumo-mogames-projects`) → Settings →
   Environment Variables → Add:** name `CRON_SECRET`, the value, **Production** (the cron runs on
   production deployments only; add Preview if you use it), tick **Sensitive**. Or answer the
   `CRON_SECRET (hidden)` prompt of `pnpm demo:setup`, which checks the length and sets it the same
   way.
3. **Redeploy** (Deployments → the latest → Redeploy), so the function reads it.
4. **Check:** Vercel → the demo project → Settings → **Cron Jobs** lists `/api/demo/sweep` with its
   schedule; press **Run** (or wait for the next run) and open **View Logs**: a 200 with a line
   `demo sweep: copies=… signups=… files=… queuedFiles=… moduleMarks=… moduleOutlines=…
   sessions=… rounds=… truncated=false`. A 401 there means the value in Vercel is not the one the
   function has (redeploy); a 503 with `request failed: ConfigError: … CRON_SECRET …` in the log
   means it is unset or short. From a browser, `/api/demo/sweep` answers 401 (and 404 on any
   other deployment).

**The schedule and what it guarantees.** Vercel's cron limits (vercel.com/docs/cron-jobs/usage-and-pricing,
read 2026-10-25): on **Hobby** a cron may run **once a day at most**, anywhere inside the hour
named (an hourly or `*/n` expression **fails the deploy**: "Hobby accounts are limited to daily
cron jobs"); on **Pro** and Enterprise down to **once a minute**, within the minute named. Which
plan the demo's team is on is **not written anywhere in this repository** (production.md asks for
Pro, hosting-account.md says why Hobby is unfit; neither records what was bought), so the entry
committed is **daily, `0 2 * * *`** (02:00 UTC, 04:00 SAST, the demo's quiet hour), which deploys
on every plan. With it:

- a copy's **sessions still end at 24 hours** exactly (the store's own rule), so nobody can use a
  copy past its day;
- its rows and files go at the **first run after it turns 24 hours old**: within **48 hours** of
  being made (49 on Hobby, with the hour's slack), even when nobody visits; sooner whenever
  anyone visits (the lazy sweep);
- a judge's sign-up account, usable for 30 days, goes within **31 days** of being made.

**The words (2026-10-26, the owner's call).** Because of that slack, the demo's words say
"deleted **after** 24 hours" (and "after 30 days"), never "within": true on every plan, with the
lazy sweep making it prompt whenever anyone visits. `packages/content/src/demo-phone-signup.test.ts`
refuses "within 24 hours" and "within 30 days" in the demo's sections.

**If the team is on Pro**, change the schedule to `*/10 * * * *` (every ten minutes): then rows
and files go within **24 hours and 10 minutes**, which is the words' "within 24 hours" to the
letter, at about 144 short function runs a day. Do not do that on Hobby: the next deploy fails.
Check the plan first (Vercel → the team → Settings → Billing).

## The universities' logos (the hackathon only)

The owner decided on 2026-10-23 to show the universities' own logos in the judge demo, for the FNB
hackathon only, setting aside option A (docs/brand/logo-permissions.md) for this one deployment.
With `NEXT_PUBLIC_UF_DEMO_LOGOS=1`, all six universities show their logo, unaltered (UKZN's
resized from a 1,683 px, 110 KB PNG to a 96 px WebP for the chip on 2026-10-25, audit A4-22), on
a small chip beside their name, and the banner adds "University logos are shown for this demo only.
UniversityFlow is not affiliated with or endorsed by these universities." UJ and UP were added on
2026-10-24: www.uj.ac.za and www.up.ac.za refuse automated visitors (Cloudflare), so each came from
another of the university's own sites: UJ's from the header of UJ News
(https://news.uj.ac.za/wp-content/uploads/2025/05/UJ_Logo.png), UP's from the header of the UP
Repository (https://repository.up.ac.za/assets/up/images/horizontal-logo-bg.webp). No university
has granted a `logoPermission`. Production and staging refuse the variable. **After the hackathon:** unset it in the demo project,
then delete `apps/web/public/demo-logos/`, `apps/web/lib/demo-logos.ts`, its CSS block and the
`DEMO_LOGO_DIR` exception in packages/catalogue logo-permission.ts.

## The public TVET colleges' logos (the hackathon only)

The same exception covers the public TVET colleges in Plan B (planning.md §19.1, 2026-10-24): with
`NEXT_PUBLIC_UF_DEMO_LOGOS=1`, a college's card shows its own logo, and the banner adds "College
logos are shown for this demo only. UniversityFlow is not affiliated with or endorsed by these
colleges." (`en.colleges.demoLogosNotice`). Each file is the college's own, downloaded on 2026-10-24
from the URL below on the college's own website (the domain its catalogue record holds), and only
resized: at most 256 px on the long side and 30 KB, as WebP (False Bay's SVG as it is). Listed in
`apps/web/lib/demo-logos.ts` (`DEMO_COLLEGE_LOGOS`); the logo scan
(packages/catalogue logo-permission.ts, `DEMO_COLLEGE_LOGO_DIR`) allows only files named by a
college id the catalogue holds. No college has granted permission.

| File | Bytes | Source (the college's own site) |
|---|---|---|
| `apps/web/public/demo-logos/colleges/east-cape-midlands.webp` | 16150 | https://emcol.co.za/wp-content/uploads/2025/12/New-logo-2025-e1765200894105.png |
| `apps/web/public/demo-logos/colleges/ingwe.webp` | 3886 | https://www.ingwecollege.edu.za/logos/ingwe_logo.jpg |
| `apps/web/public/demo-logos/colleges/king-hintsa.webp` | 14508 | https://www.khc.edu.za/wp-content/uploads/2022/11/khc-logo.png |
| `apps/web/public/demo-logos/colleges/port-elizabeth.webp` | 8754 | https://www.pecollege.edu.za/wp-content/uploads/2024/09/rgb_horizontal-01-01-01-300x97.png |
| `apps/web/public/demo-logos/colleges/flavius-mareka.webp` | 11008 | https://flaviusmareka.net/wp-content/uploads/2018/12/flavius-slider-logo-1.png |
| `apps/web/public/demo-logos/colleges/maluti.webp` | 9546 | https://www.malutitvet.co.za/assets/img/logo.png |
| `apps/web/public/demo-logos/colleges/northern-cape-urban.webp` | 15094 | https://www.ncutvet.edu.za/wp-content/uploads/2024/06/Full-colour-logo-PNG-1024x427.png |
| `apps/web/public/demo-logos/colleges/vuselela.webp` | 14956 | https://vuselelacollege.co.za/wp-content/uploads/2023/03/vuselela_logo-c-300x115.png |
| `apps/web/public/demo-logos/colleges/central-johannesburg.webp` | 18894 | https://cjc.edu.za/wp-content/uploads/2022/06/cjc-logo.png |
| `apps/web/public/demo-logos/colleges/ekurhuleni-east.webp` | 12784 | https://eec.edu.za/wp-content/uploads/2021/06/eec-LOGO.png |
| `apps/web/public/demo-logos/colleges/ekurhuleni-west.webp` | 7278 | https://www.ewc.edu.za/images/ewc-logo.JPG |
| `apps/web/public/demo-logos/colleges/south-west-gauteng.webp` | 7478 | https://www.swgc.co.za/wp-content/uploads/2022/08/Screenshot-2022-07-01-at-00.31.53.png |
| `apps/web/public/demo-logos/colleges/tshwane-north.webp` | 7448 | https://tnc.edu.za/images/tnc-logo.webp |
| `apps/web/public/demo-logos/colleges/coastal.webp` | 7716 | https://www.coastalkzn.co.za/images/ckzn_logo.png |
| `apps/web/public/demo-logos/colleges/elangeni.webp` | 9720 | https://www.elangeni.edu.za/wp-content/uploads/2024/05/Elangeni-logo-Colour-Vector.png |
| `apps/web/public/demo-logos/colleges/majuba.webp` | 28978 | https://www.majuba.edu.za/wp-content/uploads/2022/06/cropped-majuba-logo-270x270.png |
| `apps/web/public/demo-logos/colleges/mnambithi.webp` | 2698 | https://www.mnambithicollege.co.za/images/mnambithi.png |
| `apps/web/public/demo-logos/colleges/mthashana.webp` | 12990 | https://www.mthashanacollege.co.za/wp-content/uploads/2025/07/logo-1-1.png |
| `apps/web/public/demo-logos/colleges/thekwini.webp` | 7236 | https://www.thekwini.edu.za/sitepad-data/uploads/2021/08/0001-1.jpeg |
| `apps/web/public/demo-logos/colleges/umfolozi.webp` | 27614 | https://umfolozicollege.co.za/wp-content/uploads/2023/08/Umfolozi-TVET-College-Logo-May-2023-B.png |
| `apps/web/public/demo-logos/colleges/capricorn.webp` | 27396 | https://capricorncollege.edu.za/wp-content/uploads/2021/12/capricornTVETlogo.png |
| `apps/web/public/demo-logos/colleges/letaba.webp` | 11790 | https://www.letcol.co.za/images/newLogo.png |
| `apps/web/public/demo-logos/colleges/mopani-south-east.webp` | 4786 | https://mopanicollege.edu.za/wp-content/uploads/2019/12/MOPANI-LOGO.png |
| `apps/web/public/demo-logos/colleges/vhembe.webp` | 11252 | https://www.vhembecollege.edu.za/wp-content/uploads/2018/11/cropped-logo_cut.jpg |
| `apps/web/public/demo-logos/colleges/waterberg.webp` | 6888 | https://www.waterbergcollege.co.za/admin/images/main_logo.png |
| `apps/web/public/demo-logos/colleges/gert-sibande.webp` | 9360 | https://gscollege.edu.za/wp-content/uploads/2024/11/Logo-right.png |
| `apps/web/public/demo-logos/colleges/nkangala.webp` | 8050 | https://www.ntc.edu.za/images/logo.png |
| `apps/web/public/demo-logos/colleges/boland.webp` | 7142 | https://bolandcollege.com/wp-content/uploads/2022/11/Boland-Logo.png |
| `apps/web/public/demo-logos/colleges/false-bay.svg` | 19419 | https://falsebaycollege.co.za/wp-content/uploads/2021/01/fbc-logo.svg |
| `apps/web/public/demo-logos/colleges/northlink.webp` | 8840 | https://www.northlink.co.za/wp-content/uploads/2020/05/northlinklogo.png |
| `apps/web/public/demo-logos/colleges/south-cape.webp` | 25832 | https://sccollege.co.za/wp-content/uploads/2022/04/SCC-Vertical-Logo.png |

**Not shown (the neutral mark instead):** Buffalo City, Ikhala, King Sabata Dalindyebo, Goldfields,
Motheo, Sedibeng, Tshwane South, Western, Esayidi, College of Cape Town and West Coast print their
logo as one banner with DHET's logo and the national coat of arms, which is not the college's to
lend; Sekhukhune's file shows another college's logo (Gert Sibande's); Northern Cape Rural's is a
generic globe not confirmed as the college's; Lovedale, Orbit, Taletso, Umgungundlovu, Lephalale and
Ehlanzeni have no logo file on a site of their own. **After the hackathon:** the colleges' folder and
`DEMO_COLLEGE_LOGOS` go with the universities' (docs/deploy/hackathon-undo-pr.md, B).

## The bursary funders' logos (the hackathon only)

The same exception covers the bursaries listed beside NSFAS on /funding (the owner, 2026-10-25):
with `NEXT_PUBLIC_UF_DEMO_LOGOS=1`, a bursary's card shows its funder's own logo, and the banner
adds "Funder logos are shown for this demo only. UniversityFlow is not affiliated with or endorsed
by these funders." (`en.funding.demoLogosNotice`). Each file is the funder's own, downloaded on
2026-10-25 from the URL below on its own website, a raster one only resized (at most 256 px and
30 KB, WebP), an SVG as it is. Listed in `apps/web/lib/demo-logos.ts` (`DEMO_FUNDER_LOGOS`); the
logo scan (packages/catalogue logo-permission.ts, `DEMO_FUNDER_LOGO_DIR`) allows only files named
by a bursary id the catalogue holds. No funder has granted permission.

| File | Bytes | Source (the funder's own site) |
|---|---|---|
| `apps/web/public/demo-logos/funders/isfap.webp` | 9164 | https://www.isfap.org.za/assets/isfap-logo-BunfIPxh.png |
| `apps/web/public/demo-logos/funders/thuthuka.webp` | 5342 | https://saicawebprstorage.blob.core.windows.net/uploads/Logos/Thuthuka-logo-orange.jpg (SAICA's Thuthuka page) |
| `apps/web/public/demo-logos/funders/sasol.webp` | 3900 | https://www.sasol.com/sites/default/files/sasol-new-logo_0.png |
| `apps/web/public/demo-logos/funders/allan-gray-orbis.svg` | 7118 | https://allangrayorbis.org/wp-content/uploads/2023/09/Agof-Logo.svg |
| `apps/web/public/demo-logos/funders/moshal.svg` | 5924 | the inline SVG logo in the header of https://www.moshalprogram.org.za/ |
| `apps/web/public/demo-logos/funders/nedbank.svg` | 3809 | https://group.nedbank.co.za/content/dam/nedbank/logo/NEDBANK.svg |

**Not shown:** Funza Lushaka (its site's header is one banner with the Department of Basic
Education's coat of arms and photographs, not the bursary's logo alone); the FirstRand Empowerment
Foundation, Investec and the Old Mutual Imfundo Trust (no logo of their own on their own sites
could be read; their bursary pages are StudyTrust's). **After the hackathon:** the funders' folder
and `DEMO_FUNDER_LOGOS` go with the universities' (docs/deploy/hackathon-undo-pr.md, B).

## The demo's extra features: My CV, plan-map words, Read aloud (hackathon exceptions)

The owner approved on 2026-10-24 showing judges three features production holds back (the
plan-map words and Read aloud had been declined for the demo on 2026-10-23). Each is off until its
variable is set in the demo's Vercel project (Production, and Preview if you use it), and each is
read when the server starts: **redeploy after setting it**. `pnpm demo:setup` asks for each.

| Feature | Set in Vercel | What a judge gets |
|---|---|---|
| **My CV** on the built-in stand-in | `UF_CV` = `1`. Nothing else: never `UF_CV_PROVIDER` or any `MMEREKO_*` (the demo refuses them: it never calls Mmereko, D14) | Sidebar → My CV, with the line "In this demo, CVs are made by a simple built-in stand-in, not by Mmereko…". Opt in, tick the made-up school ("Sample High School (demo)", on every learner), Make my CV (ready a few seconds later), the preview and its PDF, Fit it to a job, Report this CV, delete one, Stop using Mmereko; for the three adults (Lerato, Sipho, Kagiso), check every line and make a share link. The under-18s make drafts only (§9.3) |
| **Open Mmereko** (the owner's decision of 2026-10-24; not a hackathon exception: production may carry it too, docs/deploy/production.md §6) | `UF_CV_MMEREKO_CANVAS` = `1`, with `UF_CV` = `1`. Optional `MMEREKO_APP_URL` (blank: `https://mmereko.tumoolo.tech`). Not a partner setting, so the demo allows it. `pnpm demo:setup` doesn't ask for it yet: set it by hand in Vercel | My CV → "Open Mmereko": Mmereko's own sign-in in a full-screen canvas, with "Open in a new tab" and Close. Only for the learners 18 or over or at university (the first year at UJ, the second year at Wits, the final year at UCT, and the adults); the school learners under 18 never see it. The demo's server sends Mmereko nothing; the browser loads Mmereko's public site |
| **Plan-map words** | `UF_MINDMAP_WORDS` = `1` | My goal → the learner's plan map: write in any part, its title, what got in the way and what to try. The crisis check reads every save, as the chat's does |
| **Read aloud** (ElevenLabs) | `ELEVENLABS_API_KEY` (a key just for the demo, with a credit limit) **and** `ELEVENLABS_VOICE_ID` (the voice's id). Optional: `ELEVENLABS_MODEL_ID` (blank: `eleven_multilingual_v2`). **Not** `UF_ELEVENLABS_MINORS_APPROVED`: that records ElevenLabs' approval for under-18s in production, and the demo refuses it | The Read aloud button on every campus place card and the crisis card's campus lines (public campus text only is sent). Without the key there is no button anywhere, exactly as before; a key without the voice stops the demo starting (`/api/health` 503) |

How the CV works on a demo: a demo has no job runner, and each serverless instance holds its own
memory, so the stand-in finishes each CV inside the judge's own request (apps/web/lib/server/demo/
cv-inline.ts): the same handlers, consent checks and crisis checks as anywhere, nothing left in the
job queue. The PDF is kept with the demo's other files (in its Postgres) and deleted with the copy.
A share link points at `/cv/s/<token>` on the demo and dies with the copy (24 hours; 30 days for a
judge's own sign-up account).

Check after the redeploy: `pnpm demo:smoke -- --url https://universityflow.vercel.app --cv
--plan-words` (add `--read-aloud` once the ElevenLabs key is set).

## The optional daily AI cap

`UF_DEMO_AI_DAILY_CAP` is **off unless set** (unset or empty: no cap; the owner's choice of
2026-10-23, so judges are never cut off). Set to a whole number, it is the number of chat
messages answered by the AI in the last 24 hours across the whole demo, counted in the database.
Past it, a reply starts with a kind line ("The demo has used up today's AI replies…") and comes
from the scripted stand-in; a crisis message is never counted or held back. Either way, **the
spend limit on each AI key (step 1) is what bounds the cost.**

The product's own limits apply to judges as to everyone: 60 chat messages an hour per learner
(`QUOTAS.chat`), 20 uploads a day per learner, and 120 demo starts an hour per address
(`DEMO_STARTS_PER_IP_PER_HOUR`; a judging room behind one address shares it, and 60 messages an hour is far more than a judge sends).

## Running it locally

```bash
# .env.local for a local demo: UF_DEPLOYMENT=demo, UF_DEMO_PROJECT=1, UF_PROVIDERS=local,
# AUTH_SECRET=<48 random characters>, DATABASE_URL=pglite:./.data/demo, UF_CATALOGUE_PREVIEW=1
pnpm --filter @universityflow/web dev
# The journey, against a production build:
pnpm --filter @universityflow/web build
pnpm --filter @universityflow/web test:e2e:demo
```

## Hackathon exceptions

**The owner's intention (2026-10-23): safety and the law come first. These exceptions exist only
for the FNB hackathon judging, are temporary, and are undone afterwards.** Each was approved by
the owner knowingly; none applies to the real service.

1. **The judges' real sign-up** (`UF_DEMO_SIGNUP=firebase`), the owner's words: *"approved: build
   the Firebase real sign-up for the judge demo, 18+ only, accounts deleted after 30 days"*. Judges
   may create their own real account beside the six made-up learners. Accepted for the hackathon
   only:
   - no SMS provider, so sign-in is Firebase's email link or Google, never the phone PIN (the PIN
     routes stay refused on the demo);
   - real adults' data in the demo database (the uid and email in `demo_signups`, migration
     0034, and what they type), and Google Firebase as the sign-in operator. With the demo's
     database on Supabase (London), that data is held outside South Africa too: the made-up
     learners make that harmless for them, not for the judges' own accounts. **Not yet approved by
     the owner**: keep `UF_DEMO_SIGNUP` off, or approve it knowingly and name Supabase on the
     sign-up notice;
   - the notice and consent wording on `/demo/sign-up` have had **no legal review**.

   What holds it in: adults only (a date of birth under 18 is refused in the data layer, and the
   account deleted at once); only the uid and the email are kept from Google; every account is
   deleted with everything in it **30 days after it was made** (a lazy sweep on each demo start
   and sign-in, and since 2026-10-25 the scheduled sweep of §7, daily; its sessions end at 30 days
   even before the sweep runs). **The Firebase user itself is not deleted by either sweep**: the
   server holds no service-account key, so the judge's identity stays in the Firebase project
   until the owner deletes the users or the project (undo step 3); the CSP admits Firebase
   only on the sign-up page, only with the switch on; the Firebase SDK loads on that page only.
2. **University logos** on the demo (another item of the same wave): see
   docs/brand/logo-permissions.md for what was permitted and for how long.
3. **A visitor's own photo on the profile** (`UF_DEMO_REAL_PHOTOS=1`), the owner's decision of
   2026-10-23 (late night): visitors to the demo may upload their own photo, not only the drawn
   samples. Accepted for the hackathon only:
   - a real person's face in the demo's database (with a Postgres `DATABASE_URL`, such as the
     Supabase database, the demo keeps its files there: `filesInDatabase`; otherwise its file
     folder), uploaded by a visitor whose age the demo doesn't know for the six made-up learners;
   - the plain line beside the upload ("Upload a photo of yourself only. It's deleted with this
     demo copy within 24 hours and used for nothing else." / "…with your demo account within 30
     days…" on a judge's own sign-up account) has had **no legal review**;
   - the consent-wording check on the photo (A11-31, migration 0037) stands aside for the demo's
     copies, as it does for the samples.

   What holds it in: production and staging refuse the variable (as `NEXT_PUBLIC_UF_DEMO_LOGOS`);
   the same pipeline and limits as anywhere (JPEG or PNG, 2 MB, 16 MP, A5-13; cropped, 512 × 512,
   black and white, camera details and location removed); shown only to that visitor's own copy;
   used for nothing else (never to the AI, a CV, a job or a log:
   apps/web/test/photo-used-for-nothing-else.test.ts and api-demo-real-photos.test.ts); deleted
   with the copy ("Switch learner", the 24-hour reset) or the sign-up account (30 days); the six
   samples stay offered beside it.
4. **My CV on the demo** (`UF_CV=1`), the owner's decision of 2026-10-24. Accepted for the
   hackathon only: the CV page's opt-in and consent words (consent v4 / adult-v3 are owed legal
   review) shown to judges, with the owner's preview standing in for that wording (`uf.cv`), as on
   the owner's preview; a judge with their own sign-up account may type real details into a CV
   and make a public share link to it. What holds it in: the stand-in only, never Mmereko (D14:
   the demo refuses `UF_CV_PROVIDER` and every `MMEREKO_*`); the learner's own opt-in and the
   age rules unchanged in the data layer (under-18s draft only, no share link); every word the
   crisis check reads on every save and before a CV is made; deleted with the copy or account.
5. **Plan-map words on the demo** (`UF_MINDMAP_WORDS=1`), the owner's decision of 2026-10-24
   (declined on 2026-10-23). Accepted: learners' own words, which no consent wording names yet,
   on made-up learners (and a judge's own account). What holds it in: the crisis check on every
   save, the ID/student-number refusal, the data layer's own switch (`uf.plan_words`), deletion
   with the copy.
6. **Read aloud on the demo** (ElevenLabs), the owner's decision of 2026-10-24 (declined on
   2026-10-23). Accepted: ElevenLabs as an operator on a public demo that under-18 visitors could
   open, before its written approval for under-18s exists (production still refuses the key
   without `UF_ELEVENLABS_MINORS_APPROVED=1`, A11-30). Only public campus text is sent; nothing
   about a learner.

4. **Judges sign up as a new learner on made-up details** (`UF_DEMO_PHONE_SIGNUP=onscreen`), the
   owner's decision of 2026-10-24: the real learner sign-up on the demo, a made-up 080 number, the
   PIN and the guardian's link shown on screen, every account deleted after 24 hours (§4b).
   Accepted for the hackathon only:
   - the PIN and a consent link are returned to the browser instead of sent: a sign-in secret on
     screen, acceptable only because the numbers are toll-free (nobody's phone) and the accounts
     made up;
   - the notice asks for made-up details but can't enforce it: a judge who types a real name,
     school or ID number puts it in the demo database (Supabase, London) for up to 24 hours. (Two
     judges on the same number no longer share an account: only the browser that made it gets
     its PIN);
   - 100 PIN requests an hour per address instead of 10 (the owner's approval of 2026-10-24);
   - the notice wording has had **no legal review**.

   What holds it in: 080 numbers only, in the routes and in the data layer (only a demo store
   takes one); no SMS provider is ever configured on a demo (`checkDemo`); the PIN and link are
   never logged; a taken number is its maker's browser's alone; the product's other limits stay
   as they are; production and staging refuse the switch;
   unset, the demo is exactly as before.

7. **The university learners agree to the DRAFT adult-v3** (module outlines, Phase 6b, 2026-10-24,
   under the owner's approval of Phase 6 and its brief). Module outlines need consent wording that
   names them (guardian v4 / adult-v3, D9), owed legal review and not live; migration 0040 refuses
   an outline under anything older, for everyone. So the judges can upload the SAMPLE module
   outline ("Use a sample module outline" under My modules → Add a module outline), the demo's
   three made-up university learners record the draft wording as `adult-v3-draft-demo-only`.
   Accepted: a made-up record of agreeing to wording no lawyer has approved. What holds it in: no
   real person agrees to it; the production gate is unchanged (every other learner, the on-screen
   sign-up's included, is refused an outline); the demo takes only the generator's SAMPLE outline
   PDFs; the copies go with the 24-hour sweep. It also covers the profile photo for those three
   (C5 is in the same draft).

**What to undo after the hackathon:**

- Unset `UF_DEMO_SIGNUP` and the three `NEXT_PUBLIC_FIREBASE_*` values in the demo project and
  redeploy (the sign-up page, its route and the CSP widening all switch off with them).
- Delete the accounts: delete the demo's database (below), or run
  `delete from students where id in (select student_id from demo_signups);` against it; then
  delete the Firebase project (its users go with it). The scheduled sweep (§7) deletes each
  account 30 days after it was made without visits, but never the Firebase user, and the promise
  is kept sooner by deleting them now.
- The scheduled sweep (§7, a hackathon exception: hackathon-undo-pr.md M): delete `CRON_SECRET`
  in the demo project, remove the `crons` entry from `apps/web/vercel.json` and the route, and
  redeploy; or keep both for as long as the demo is up (it deletes only what the demo's words
  promise).
- Remove the code: the sign-up page and route, `lib/demo-signup.ts`, the identity verifier, the
  `firebase` dependency, and a migration that drops `demo_signups`.
- Revert the university logos as their own item says.
- Unset `UF_CV`, `UF_MINDMAP_WORDS`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` and
  `ELEVENLABS_MODEL_ID` in the demo project, redeploy, and revoke the demo's ElevenLabs key
  (hackathon-undo-pr.md E, F, G).
- Unset `UF_DEMO_PHONE_SIGNUP` and redeploy (the PIN routes answer 404 again); its accounts go
  within 24 hours by the sweep, or at once with the demo's database (hackathon-undo-pr.md, H).
- Put the university learners back on the live adult wording (hackathon-undo-pr.md, I): code only,
  no variable.
- Put `apps/web/vercel.json` back to `"regions": ["cpt1"]` (hackathon-undo-pr.md, J: the demo's
  functions in London beside its database, the owner's choice of 2026-10-25 for a fast start).
  Production refuses to start outside `cpt1` meanwhile, so it cannot launch until this is undone.
  Because the demo is in London, its front door never says "Your information stays in South
  Africa": it says real learners' information will, and that this demo runs in London
  (`en.home.barHereDemo`, `barHereDemoWhere`; production unchanged). Review that wording when J is
  undone: it stays true while the demo's database is in London.

The whole undo, as a ready-to-open PR with the console steps, the file list, the tests to add and
a test plan: [hackathon-undo-pr.md](hackathon-undo-pr.md).

## Taking it down

Delete the demo's Vercel project and its database (Supabase → the demo project → Project
Settings → General → Delete project). Nothing in production depends on either.
