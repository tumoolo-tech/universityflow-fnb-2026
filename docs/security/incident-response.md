# Incident response and breach notification

> **DRAFT for the owner to adopt. Not in force yet.** Drafted 2026-10-22, rewritten 2026-10-24
> (wave 6) for finding **A5-08** (research SEC-02). It becomes the plan only when the owner adopts
> it, fills every "**Owner to fill**" line, registers on the Information Regulator's eServices
> portal and runs one tabletop exercise. **It is not legal advice.** The law below is quoted only
> where our research briefs quote it (docs/research/2026-10-22-security-brief.md §2.2–2.5 and
> docs/research/2026-10-22-legal-and-regulatory-brief.md §1.4). Every line marked
> "**Lawyer to confirm**" goes to the legal adviser before adoption; the full list is at the end.

Contents: 1 Who · 2 What counts · 3 Severity · 4 The first hour · 5 The switches and keys ·
6 Assess · 7 Who decides · 8 Notifying the Regulator · 9 Notifying learners and guardians ·
10 Operators · 11 Evidence and logs · 12 Crisis disclosures are not breaches · 13 Special cases ·
14 After the incident · 15 The register · 16 Before launch · 17 Questions for the lawyer.

## 1. Who

| Role | Who | Reach (day and night) |
|---|---|---|
| **Responsible party** (POPIA: the organisation that answers for the data) | Owner to fill: full legal name, legal status, registration number | Owner to fill |
| **Incident lead** (decides, owns the clock) | The owner, TUMO OLO | Owner to fill: cellphone, and a second number |
| **Deputy incident lead** (acts when the lead can't be reached within 30 minutes) | Owner to fill | Owner to fill |
| **Information Officer** (POPIA s55; files with the Regulator) | Owner to fill: name, once registered (A11-10, A11-20) | Owner to fill: email and phone |
| **Legal adviser** | Owner to fill: name and firm | Owner to fill: phone, and an after-hours number if the firm has one |
| **Safeguarding lead** (abuse and child-safety disclosures, A11-23; see section 12) | Owner to fill | Owner to fill |
| **Developer on call** (rotates keys, runs the database steps) | Owner to fill | Owner to fill |
| Each operator's security contact | See section 10 | Owner to fill, per operator |

**Anyone who notices something wrong tells the incident lead at once**, even when unsure. A false
alarm costs nothing. A late report can cost a learner, and the Regulator has penalised late and
missing notifications (security brief §2.1).

Keep a printed or offline copy of this page and of the contacts. If GitHub, a laptop or the
password manager is part of the incident, the online copy may be out of reach. Owner to fill:
where the offline copy is kept.

## 2. What counts

### 2.1 A security compromise (POPIA s22)

The research quotes the trigger as **"reasonable grounds to believe"** that personal information
has been accessed or acquired by an unauthorised person (s22(1)). The Regulator's guide, as
summarised in the security brief, says there is no threshold: "Any instance where personal
information is lost, stolen, leaked, or otherwise exposed qualifies." An accidental internal
mistake counts too: in May 2026 the Regulator treated a misdirected email at a TVET college as a
s22 compromise (security brief §2.1). **Lawyer to confirm** the threshold and that there is no
"low-risk" exemption.

Examples for this product:

- **A leaked secret:** `AUTH_SECRET`, `DATABASE_URL` (it carries the database password), an AWS
  key, `ANTHROPIC_API_KEY`, the SMS or WhatsApp company's keys, `EXPO_ACCESS_TOKEN`,
  `MMEREKO_CLIENT_SECRET` or `MMEREKO_WEBHOOK_SECRET`, a `.env` file pushed or pasted anywhere.
- **Storage exposed:** an S3 object or the bucket readable by the public; a database snapshot or
  export outside af-south-1; a real student document on a laptop (never allowed: CLAUDE.md).
- **Sign-in failures:** a session or sign-in bypass; an account opened by someone else (a SIM
  swap or a recycled number, SEC-05); the store-review sign-in used by someone other than the
  store's reviewer.
- **Separation failing:** row-level security letting one learner see another's rows; a CV share
  link showing the wrong CV.
- **Mis-sent messages:** an SMS, WhatsApp or push with personal details to the wrong number; a
  guardian consent link sent to the wrong person; a crisis reply reaching someone other than the
  learner (section 13).
- **An operator's breach:** Vercel, AWS, Anthropic, the SMS company or another operator tells us
  of a breach that touches our data (section 10).
- **Lost devices:** a laptop or phone with a database copy, an export or production secrets lost
  or stolen.
- **The judge demo**, while a hackathon exception is on: the judges' own sign-up accounts (their
  email addresses, in Supabase, London) or a visitor's own photo (`UF_DEMO_REAL_PHOTOS=1`) are
  real people's information. A compromise of the demo's database is then a compromise of real
  data, even though the six learners are made up (docs/deploy/demo.md, "Hackathon exceptions").

### 2.2 An incident that is not (yet) a compromise

Some events need this plan's first hour but may turn out to involve no personal information: an
outage, a denial-of-service, a vulnerability found before anyone used it (for example the Next.js
advisories in SEC-01), an SMS-cost attack (A1-01), a leaked key that the provider's logs show was
never used. **Treat each as a compromise until the facts show otherwise**, and write the reason
for the final call in the register (section 15).

**Not every bug is a compromise. Not every compromise starts as a bug.** When in doubt, run the
plan.

## 3. Severity

The incident lead sets the level in the first 15 minutes and may raise or lower it as facts come
in. The level sets the pace, never whether the law applies: any compromise is notified (section
8), whatever its level.

| Level | Means | Examples | Pace |
|---|---|---|---|
| **S1 Critical** | Personal information of many learners, of minors, or special personal information (chats, health, crisis disclosures) is exposed or likely exposed; or the exposure is ongoing | `DATABASE_URL` or an AWS key leaked; the bucket public; RLS broken in production; a crisis chat sent to a stranger | Everyone in section 1 now, day or night. Contain within the hour. Lawyer the same day |
| **S2 High** | Personal information of one or a few learners exposed; or a secret leaked that could expose it, with no sign yet of use | One guardian's consent link sent to the wrong number; `AUTH_SECRET` in a public log; a SIM-swapped account | Incident lead and developer now; Information Officer and lawyer the same day |
| **S3 Medium** | A real weakness, no sign of exposure | A known vulnerability in a deployed dependency; a misconfiguration found by an audit | Within one working day; a finding row (section 14) |
| **S4 Low** | Suspicious but contained, no personal information involved | A failed attack the limits stopped; a key leak with no access to data | Within the week; a register entry |

## 4. The first hour

Do these in order. Write each step, with its time, into the incident log (section 11) as you go.

1. **Open the incident log** and write: who found it, when, how, and the first facts. IDs only,
   never a learner's name, number or message (hard rule 4).
2. **Call the incident lead.** The lead sets the level (section 3) and calls whoever that level
   needs.
3. **Contain.** Stop the leak with the switches in section 5: revoke or rotate the exposed key,
   make the object private, turn the feature off, end the sessions. Choose the smallest step that
   stops it; take the whole site down only for S1 when nothing smaller works.
4. **Preserve evidence before you change more** (section 11): snapshot the database, export the
   logs. Never delete evidence while containing. Never "clean up" rows an attacker touched until
   they are copied.
5. **Start the clock for notification.** The time of discovery is the time that "as soon as
   reasonably possible" runs from (section 8). Write it down.
6. **Tell the Information Officer** (S1 and S2 at once) so they can open the eServices portal.

## 5. The switches and keys that exist today

From `apps/web/lib/server/config.ts` (`readConfig`) and docs/deploy/production.md. Every change
is made in **Vercel → the production project → Settings → Environment Variables (Production)**,
then **Redeploy**: the server reads its variables when it starts. **Owner to fill:** how long a
redeploy takes, measured in the tabletop.

**Important:** production refuses to start when a required variable is missing or unsafe
(`UF_PROVIDERS` must be `live`; `AUTH_SECRET`, `DATABASE_URL`, `UF_PUBLIC_URL`, `UF_S3_BUCKET`,
`ANTHROPIC_API_KEY`, `UF_SMS_PROVIDER` and `UF_JOBS_PROVIDER` must be set). **Removing one of
those takes the whole site down** (every request fails; `/api/health` answers 503). That is a
deliberate last resort, not a way to turn one feature off.

### 5.1 Features you can switch off on their own

| What | How | Effect |
|---|---|---|
| **My CV** (Mmereko) | Unset `UF_CV` **and** `UF_CV_PROVIDER` together (one without the other is refused) | Every CV route answers 404. Not on in production today (refused until consent v4) |
| **Profile photo** | Unset `UF_PROFILE_PHOTO` | `/api/me/photo` answers 404 (removal still works); neither app offers a photo. Not on in production today |
| **WhatsApp** | Unset `UF_WHATSAPP_PROVIDER` | WhatsApp is not offered. What happens to WhatsApp reminders already scheduled is not yet tested: Owner to fill after the tabletop |
| **Push notifications** | Unset `UF_PUSH_PROVIDER`; revoke `EXPO_ACCESS_TOKEN` at expo.dev | No pushes sent. A revoked token stops anyone holding push tokens from sending under our name (A5-03) |
| **Read aloud** (ElevenLabs) | Unset every `ELEVENLABS_*` (and `UF_ELEVENLABS_MINORS_APPROVED`) | No Read aloud button anywhere. Not on in production today (A11-30) |
| **Store-review sign-in** | Unset `UF_REVIEW_PHONE`, `UF_REVIEW_PIN_HASH`, `UF_REVIEW_UNTIL` together | The review number becomes an ordinary one. Ten wrong review PINs already lock it until a new hash is set |
| **SMS volume** | Lower `UF_SMS_BUDGET_PER_HOUR` / `_PER_DAY` and `UF_SMS_REMINDER_BUDGET_*` (whole numbers, at least 1; hour not above day) | Caps what can be sent. Too low a sign-in budget stops learners signing in |
| **WhatsApp volume** | Lower `UF_WHATSAPP_BUDGET_*` | As above, for template messages |

### 5.2 What has no switch of its own (gaps)

- **The AI.** There is no variable that turns the chat or document reading off in production.
  `UF_PROVIDERS=local` (the scripted stand-in) is refused in production, and so is Gemini as a
  fallback. To stop calls to Anthropic, **revoke the key in the Anthropic Console**. What learners
  then see in the chat and on uploads is not yet tested. Owner to fill after the tabletop. A
  proposed finding: an AI off switch that keeps the crisis card working (see the report for
  A5-08).
- **SMS sending.** `UF_SMS_PROVIDER` is required. To stop all SMS, revoke the key in the SMS
  company's dashboard (sign-in PINs and guardian links then fail), or lower the budgets to 1.
- **The whole site.** No maintenance switch exists. Options, smallest first:
  - **Vercel Instant Rollback** to the last good deployment (when a bad deploy is the cause);
  - **Vercel Firewall**: block the abusing IP addresses, or turn on Attack Challenge Mode
    (security brief §2.5; check what the team's plan includes: Owner to fill);
  - as a last resort, remove a required variable and redeploy: the site refuses every request.
  Owner to fill: which of these to use for "take production offline now", tried in the tabletop.

### 5.3 Rotating secrets: what each rotation does

| Secret | How | Effect on learners and on what is in flight |
|---|---|---|
| `AUTH_SECRET` | A new 48+ character value (docs/deploy/production.md §4), redeploy | **Does not sign anyone out**: session tokens are stored as plain SHA-256 hashes, not keyed by it (`packages/db/src/crypto.ts`). It **does**: invalidate every sign-in PIN in flight (learners ask for a new one); reset every rate-limit and wrong-PIN count (keys are HMACs under it; an attacker gets a fresh count); invalidate the store-review PIN hash (`UF_REVIEW_PIN_HASH` must be re-made); invalidate CV PDF links (they last 60 seconds, so harmless). **And a trap:** the STOP suppression list keeps phone numbers as HMACs under it (`suppressionHash`), so a rotation **silently forgets every STOP from a number without an account**, such as a guardian who replied STOP (security brief §2.5). No two-key rotation (`AUTH_SECRET_PREVIOUS`) exists yet. Rotate only when the secret is truly exposed, and note the lost STOPs as a risk in the incident log. Proposed finding in the report |
| Sessions (sign-in on web **and** the app) | Delete the rows: all of `sessions`, or the affected learners' (`where student_id = …`). The app's bearer token and the web cookie both resolve through that table (`apps/web/lib/server/session.ts`) | Those learners are signed out everywhere and sign in again with a PIN. Delete their `push_tokens` too to stop notifications to a stolen phone. Deleting sessions is the only way to end them: rotating `AUTH_SECRET` does not |
| Guardian consent links | Not keyed by `AUTH_SECRET` (stored as SHA-256 hashes). Unanswered links end at their `expires_at` | To kill an unanswered link early, a developer ends that one row's validity. Never touch a granted or withdrawn consent. Owner to fill: a tested script, so nobody writes SQL under pressure |
| CV share links (adults only) | Revoke in the product (the learner, or `revoked_at` on the row) | The link stops working. Not keyed by `AUTH_SECRET` |
| `DATABASE_URL` | Change the RDS user's password in AWS, update the variable, redeploy | The site is down between the password change and the redeploy. Plan for minutes. Also check who else holds the old URL (laptops, CI) |
| AWS keys (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) | Deactivate in IAM at once, then make new ones (or move to a role) | Uploads and file reads fail until the new keys are set |
| `ANTHROPIC_API_KEY` | Revoke in the Anthropic Console, make a new one with a spend limit | Chat and document reading fail until the new key is set |
| SMS company keys | Rotate in its dashboard | PINs and reminders fail until updated |
| `UF_MESSAGING_WEBHOOK_SECRET` | New 32+ character value | Inbound messages signed with the old one are refused |
| `EXPO_ACCESS_TOKEN` | Revoke at expo.dev, make a new one | Pushes fail until updated |
| Mmereko secrets | Set the new value in `MMEREKO_CLIENT_SECRET_NEXT` / `MMEREKO_WEBHOOK_SECRET_NEXT`, swap, then remove the old one | The `_NEXT` pair is there for rotation (docs/design/mmereko-api-proposal.md, `.env.example`). Not live yet; the exact order of steps is Owner to fill when Mmereko connects |
| The demo's `AUTH_SECRET`, `DATABASE_URL`, AI keys | As above, in the **demo's** Vercel project | The demo has no PINs; the effects are on its sessions and its database only |

After any rotation: check that no laptop, CI secret or chat message still holds the old value.
A supply-chain compromise means rotating **every** token a laptop or CI held (security brief
§2.5).

## 6. Assess

As soon as the leak is contained, answer these, in the incident log, with counts and IDs only:

- **Whose information?** Learners, guardians, adult learners, judges (demo only).
- **Which information?** Use the privacy page's "What we collect" and the tables in
  docs/store/privacy-and-data-safety.md ("Learner tables") as the map. Was it special personal
  information (chats, health, crisis disclosures), marks, uploaded letters (which carry ID
  numbers and home addresses), guardians' names and numbers?
- **How many**, and **how many under 18**?
- **Who got it**, if known, and is it still exposed?
- **Which operator was involved**, and has it told us what it knows?
- **When did it start**, and when did we find it?

## 7. Who decides

- **The incident lead decides** the level, the containment, whether to take the site down, and
  whether and when to notify. The deputy decides when the lead can't be reached within 30
  minutes.
- **The Information Officer files** with the Regulator and keeps the register.
- **The legal adviser advises** on whether s22 applies, the wording of notices, and any police
  report. Their advice is sought, but **notification is not held back waiting for it** when the
  facts are clear.
- **The rule when unsure: notify.** A decision **not** to notify is written in the register with
  its reasons and who made it.
- Nobody talks to the media, a university or a school about an incident without the incident
  lead's agreement.

## 8. Notifying the Information Regulator

**When:** "as soon as reasonably possible after the discovery", allowing for the needs of law
enforcement and for measures to find the scope and restore the system's integrity (s22(2), as
the security brief quotes it). There is no fixed 72-hour clock, but **don't wait for the
investigation to finish** (security brief §2.3). A delay may be required only by a public body
responsible for investigating crime, or by the Regulator (s22(3)). **Lawyer to confirm** who may
direct a delay, and in what form.

**How:** online only, through the **eServices portal**, the Security Compromises module:
https://eservices.inforegulator.org.za . It has been mandatory since 1 April 2025; email reports
are no longer accepted (both research briefs). The two briefs differ on the old paper form
SCN1: one says it is no longer accepted, the other that firms are unsure whether the portal fully
replaces it. **Lawyer to confirm.** Use the portal either way.

**Register before launch.** The portal needs an account and registration first. Finding that out
at 2am is the wrong moment (security brief §2.3). Owner to fill: who holds the portal account,
and the date it was registered.

**What to have ready** (the portal's own fields decide what is asked: Owner to fill, after
registering, a copy of its fields here):

- the responsible party and the Information Officer's details (section 1);
- when the compromise happened, when it was discovered, and how;
- what information, how many people, how many minors;
- who obtained it, if known;
- what we have done to contain it and what we will do;
- what we are telling the people affected, how and when (section 9);
- the operator involved, if any.

**After filing:** write the date, time and the portal's reference number in the register. Send
updates through the portal as facts change. The Regulator may direct how data subjects are told
(s22(4)); follow it.

**The Regulator's details** (from the privacy page, read from inforegulator.org.za on
2026-10-23; re-check before launch): Woodmead North Office Park, 54 Maxwell Drive, Woodmead,
Johannesburg, 2191 · 010 023 5200 · toll-free 0800 017 160 · enquiries@inforegulator.org.za ·
https://inforegulator.org.za .

## 9. Notifying learners and guardians

**Who:** each affected person. **For a learner under 18: the learner and the guardian.** POPIA
has no explicit rule on whether to notify the learner, the guardian or both; the research says
to notify both and get legal advice (security brief §2.3). **Lawyer to confirm**, and also for a
learner who has turned 18 since the guardian agreed, and for an account already deleted.

**When:** with the Regulator's notification or as soon after as possible, unless a delay is
directed under s22(3).

**How** (s22(4), as the research lists it): in writing, by mail, email, publishing on the
website, prominent news media, or as the Regulator directs. **Our channels:** we hold cellphone
numbers (learners' and guardians'), not email addresses. So:

- an **in-app notice** (web and app) to each affected learner;
- an **SMS** to each affected learner and guardian: a short fixed sentence that points to the app
  and the website, with no personal details in it. Raise the SMS budget for it if needed
  (section 5.1);
- a **notice on the website** for anyone we can't reach (a deleted account, a changed number);
- **Lawyer to confirm** that an in-app notice plus an SMS counts as "in writing".

**What the notice must say** (s22(5), as the research lists it): enough for the person to protect
themselves:

- the possible consequences;
- what we have done or will do about it;
- what the person should do;
- the identity of the unauthorised person, if known.

Add, every time: **"We will never ask you for your PIN, a password or money."** People who know
about a breach send fake "breach notices" to steal sign-ins.

**Draft wording** (for the lawyer; once agreed it moves into `packages/content`, hard rule 8, so
it isn't written under pressure):

> **SMS:** "UniversityFlow: some of your information may have been seen by someone it wasn't
> meant for. Open the UniversityFlow app or [website] for what happened and what to do. We will
> never ask for your PIN or money."
>
> **In-app and web notice:** "On [date] we found that [what happened, in one sentence]. It
> involved [which information]. This could mean [possible consequences]. We have [what we did]
> and will [what we will do]. You can [what to do: for example, watch for messages asking for
> your PIN, check your account under About me, contact us]. [Who obtained it, if known.] We have
> told the Information Regulator. Questions: our Information Officer, [contact]. You can also
> complain to the Information Regulator: [details]."

**Apple and Google:** tell them if the app itself is involved (security brief §2.5). Owner to
fill: the contact route for each store.

## 10. Operators

POPIA s21 requires a **written contract** with each operator, and s21(2) requires the operator
to tell us **immediately** when it believes there has been unauthorised access (security brief
§2.2). Each operator's own breach clause and notice period must be checked against that before
its account goes live; the research recommends a register of these contracts in
`docs/security/operators.md` (not yet written).

| Operator | Role here | Holds or sees | Where | Breach clause and security contact |
|---|---|---|---|---|
| **Vercel** | Runs the website and the API the app calls | Every request, with the IP address; runtime logs | Functions in Cape Town (`cpt1`); a United States company. Where its logs are kept is an open s72 question (legal brief §1.4) | Owner to fill. Its DPA covers the Pro plan only (docs/deploy/production.md §7) |
| **AWS**, af-south-1 | The database (RDS) and file store (S3) | Everything we keep, encrypted | Cape Town | Owner to fill |
| **The SMS company** (not chosen) | Sign-in PINs, guardian links, reminders, STOP and replies | Phone numbers and messages | Owner to fill | Owner to fill |
| **Meta / a WhatsApp partner** (optional) | WhatsApp reminders and replies | Phone numbers, template ids, replies | Outside South Africa | Owner to fill |
| **Expo, then Apple and Google** | Push notifications | Push tokens, fixed sentences | Outside South Africa | Owner to fill |
| **Anthropic** | The chat and reading uploads | Chat messages, images of reports and letters | United States | Owner to fill. Ask for zero data retention: these are children's chats (security brief §2.2) |
| **Mmereko** (not live) | The CV engine (My CV, adults only) | CV data | Its partner cell must be in af-south-1 (`MMEREKO_REGION`, A11-35) | Owner to fill |
| **ElevenLabs** (off for learners) | Read aloud's voice | Public campus text only, nothing about a learner | Outside South Africa | Owner to fill |
| **The job scheduler** (not chosen; Trigger.dev or our own database) | Scheduled work | Account ids only | Owner to fill | Owner to fill |
| **Sentry** (planned, SEC-11) | Error reports | Must be scrubbed of personal data | Owner to fill | Owner to fill |
| **GitHub** | Code and CI | Secrets stored for CI and deploys (`VERCEL_DEPLOY_HOOK_URL`); no learner data | United States | Owner to fill |
| **Supabase** (judge demo only) | The demo's database | Made-up learners; with the hackathon exceptions on, judges' emails and visitors' photos | London (`eu-west-2`) | Owner to fill |
| **Google Firebase** (judge demo only) | Judges' sign-up, when `UF_DEMO_SIGNUP=firebase` | Judges' email addresses | Outside South Africa | Owner to fill |
| **Google Gemini** (judge demo only; refused in production) | The demo's chat, when chosen | What judges type | Outside South Africa | Owner to fill |

**When an operator tells us of a breach:** it is our incident. We are the responsible party, and
we notify the Regulator and the people affected, not the operator (**Lawyer to confirm**). Ask
the operator, in writing: what happened, when, which of our data, whether it is contained, and
its reference number. Keep their answers with the incident log.

## 11. Evidence and logs

**Hard rule 4 applies during an incident too:** IDs only. Never copy a learner's name, number,
message, marks or document into the incident log, a chat group, an email or a ticket. If someone
needs to see a record, they look at it where it is, and the incident log says which ID they
looked at and why.

| Source | What it holds | Where | Keep it by |
|---|---|---|---|
| **Vercel runtime logs** | One line per failed request (the error's name only); `request failed: ConfigError: …` (variable names, never values); alert lines with IDs only: store-review sign-ins, reply reports, CV reports, a capped crisis reply (no ID), read-aloud failures, sweeps that could not be scheduled | Vercel → the project → Logs | Exporting them in the first hour. Owner to fill: how long the team's plan keeps them |
| **`audit_log`** (database) | Who or what touched a learner's data: time, actor type and ID, student ID, action, reason. Append-only by trigger | RDS | Copying it early. The table owner can switch the trigger off (SEC-07), so with a leaked `DATABASE_URL` it can't be fully trusted after the leak |
| **The database itself** | Everything | RDS, af-south-1 | An RDS snapshot before any clean-up. Point-in-time recovery is planned, not yet set (SEC-12) |
| **AWS CloudTrail** | Who used AWS keys and when | AWS | Exporting it. Not yet switched on (SEC-13): Owner to fill when it is |
| **S3 access logs** | Who read which object | AWS | Owner to fill: whether they are on |
| **Each operator's console** | Anthropic usage, the SMS company's sending logs, Expo's push receipts, Vercel's deployments | Their dashboards | Screenshots or exports. The SMS logs carry phone numbers: leave them there and note only their reference |
| **GitHub** | Commits, Actions runs, secret-scanning alerts | GitHub | Exporting them when a leaked secret or a supply-chain attack is suspected |
| **The incident log** | The timeline, decisions, who did what | Owner to fill: one place, access limited to section 1's people | At least as long as the register (section 15) |

Logs with IDs only can be shared with the Regulator and the lawyer without exposing anyone.

## 12. Crisis and child-safety disclosures are not breaches

A learner who tells the companion about self-harm, abuse or sextortion has **given** us that
information, lawfully, in their own chat. That is **not a security compromise**. It is a
safeguarding matter, handled by the crisis protocol (planning.md §4.3: the crisis card, the
helplines, a human flag where the learner agreed) and the red-team suite (hard rule 7).

The difference:

| | A disclosure | A security compromise |
|---|---|---|
| What happened | The learner told us something serious | Someone without authority saw or got information |
| Who acts | The safeguarding lead | The incident lead |
| What follows | Care, helplines, and any report the law requires | Containment, notification under s22 |
| The law | Mandatory reporting, owed in a policy (below) | POPIA s22 |

They meet in three places, and each is run under **this** plan as well:

- **A crisis message or reply goes to the wrong person** (a misdelivered SMS, a recycled number,
  a SIM swap). That is a compromise of special personal information about a child: **S1**.
- **Someone else reads a learner's chat** (a shared phone, a stolen session). End the sessions
  (section 5.3) and treat it as a compromise.
- **A disclosure is evidence of a crime.** The Cybercrimes Act's offences (threats, incitement,
  intimate images) are what the crisis protocol detects (security brief §2.4). The app must not
  become an evidence store, and nobody copies a chat out of the database on their own initiative.

**Mandatory reporting is not decided yet.** Finding **A11-23** (High, Open): the Sexual Offences
Act s54 and the Films and Publications Act s24C may oblige us to report some disclosures, and
there is no safeguarding policy or lead. **That policy is owed by the owner and the legal
adviser**, and the code follows it. Until it exists, the safeguarding lead (section 1) calls the
legal adviser before any report about a disclosure, and writes in the incident log only that a
disclosure was handled, with its ID, never its content. **Lawyer to confirm** what to preserve,
for how long, and for whom, when a learner discloses a crime.

## 13. Special cases

- **An AI provider incident** (prompts held abroad): Anthropic holds chats and document images
  in the United States. Ask what was exposed and for how long they kept it; our notification
  duty is the same.
- **A misdelivered message:** check the number we hold against what the learner or guardian gave
  us; stop the channel if it is a provider fault (section 5.1).
- **SIM swap or a recycled number** (SEC-05): end the account's sessions, delete its push tokens,
  and notify the learner (and guardian) through the website notice and a call where possible: the
  phone number may be the attacker's.
- **A supply-chain compromise** (a poisoned package): stop deploys, rotate every token a laptop
  or CI held, check the deployed build against a clean one.
- **The judge demo:** take it down if needed (delete the demo's Vercel project and its Supabase
  project: docs/deploy/demo.md, "Taking it down"). Nothing in production depends on it. If the
  hackathon exceptions were on, judges and visitors are real people to notify.

## 14. After the incident

1. **Fix the cause with a test that fails without the fix** (hard rule 10).
2. **Add a finding row to status.md** (Open findings), in the usual form, for example
   `| A5-NN | A5 | High | location | what failed | Open | the fix |`, and close it only with the
   test. A phase can't close with an open Critical or High finding.
3. **Review within two weeks**: what failed, what caught it, how long each step took, what the
   notices said, what changes. Write the review next to the incident log (IDs only).
4. **Update this page** with anything the incident taught: a missing switch, a contact that
   didn't answer, a step that took too long.
5. **Complete the register entry** (section 15) and close it.

## 15. The register

Every incident, including suspected ones that turned out to be nothing, gets one entry. Counts
and IDs only. Kept for at least five years (**Lawyer to confirm** the period). Owner to fill:
where the live register is kept, if not here.

| Date found | Level | What (one line, no personal information) | Personal information? | People affected (minors) | Regulator notified (date, portal reference) | People notified (date, how) | Decision not to notify (why, who) | Finding | Closed |
|---|---|---|---|---|---|---|---|---|---|
| *(none yet)* | | | | | | | | | |

## 16. Before launch

- [ ] The owner adopts this page and fills every "Owner to fill".
- [ ] The legal adviser answers section 17.
- [ ] The Information Officer is registered (A11-10, A11-20), and an **eServices portal** account
      is ready, with its fields copied into section 8.
- [ ] Each operator's contract or DPA is filed, its breach clause checked against s21(2), and
      its security contact listed in section 10.
- [ ] The notice wording (section 9) is reviewed and moved into `packages/content`.
- [ ] A tested way to take production offline, to end one learner's sessions and to kill an
      unanswered consent link (section 5), so nobody writes SQL under pressure.
- [ ] **One tabletop exercise**: a leaked `DATABASE_URL` on a Friday evening, walked end to end,
      with the timings written into this page. Then once a year (security brief §2.5).
- [ ] A11-23's safeguarding policy exists, or the gap is accepted in writing.

## 17. Questions for the lawyer

1. **Threshold:** confirm that every s22 compromise is reportable, with no low-risk exemption,
   including an internal mistake with no outside attacker (the TVET college notice).
2. **Delay (s22(3)):** who may direct a delay in notifying data subjects, and how we record it.
3. **The form:** is the eServices portal the only route, or is form SCN1 still accepted? The two
   research briefs disagree.
4. **Minors:** notify the learner, the guardian, or both? And a learner now over 18 whose guardian
   agreed earlier? And someone whose account is already deleted?
5. **"In writing" (s22(4)):** does an in-app notice plus an SMS pointing to it count, given that
   we hold no email addresses?
6. **Notice wording:** review section 9's draft against s22(5).
7. **Operators:** confirm that an operator's breach is ours to notify; and whether each operator's
   published notice period meets s21(2)'s "immediately".
8. **The register:** how long to keep it, and whether the Regulator expects a particular form.
9. **Crisis disclosures (with A11-23):** what we must report and to whom; what to preserve when a
   learner discloses a crime, and for how long; whether reply and CV reports are kept after an
   account is deleted (A10-35, CV5-01).
10. **The judge demo:** with the hackathon exceptions on, judges' emails and visitors' photos sit
    with Supabase (London) and Firebase. Is a compromise there notifiable in the same way?
11. **Vercel's logs:** where they are processed, and whether that is a s72 transfer.
12. **Cybercrimes Act s54:** confirm it is not in force and doesn't apply to us (SEC-27).
