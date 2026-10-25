# PHASE-4 — A5 Security

**Project:** UniversityFlow · **Phase:** 4 · **Date:** 2026-10-14
**Commit:** 7d53bc6 (branch `phase-4/audits`) · **Audit source:** tumoOLO_Audits @ 29eafd7
**Result:** 0 Critical · 0 High · 4 Medium · 3 Low · 0 waived · 7 not measured

First run of A5 on this project, so it covers the whole system, with the weight on what
planning.md §11 names for Phase 4: inbound webhooks, push tokens, inbound abuse, the new API routes
(`git diff 17ca607..7d53bc6 -- apps/web/app/api`), the job pipeline, the camera/PDF upload path, and
production refusing stand-ins. Report only: nothing was fixed. Every exploit below was proven
with a throwaway integration test over the real route handlers and PGlite
(`apps/web/test/a5.audit-tmp.test.ts`, 4/4 passing), then deleted.

---

## 1. Executive summary

The system is in good shape for an attacker without an account. Every learner route goes through
the same guard (`requireReady`/`requireSignedIn`). That guard has a CSRF same-origin check, a
bearer-only exemption and the native pre-auth rule. Every learner read and write goes through
`StudentStore`, which applies row-level security and the database consent gate. None of the 14
new or changed Phase 4 routes takes another learner's id, so no IDOR was found. Job payloads hold
IDs only, checked three times. Production refuses every stand-in, and the stand-in webhook does
not exist in live mode.

What's left is **abuse and design gaps in the Phase 4 messaging layer**, not open doors. None of
them is exploitable in production today, because no live SMS, WhatsApp or push adapter has been
switched on yet. Each one needs fixing before that switch is flipped.

**Top 5 risks**
1. **A5-01:** Reminders and sign-in PINs draw from **one global SMS budget**, so reminder volume
   can lock every learner out of sign-in. Proven.
2. **A5-02:** **Live mode has nowhere to receive STOP.** The SMS adapter contract has no inbound
   half, yet the UI tells learners "Reply STOP".
3. **A5-03:** **Expo "enhanced push security" is optional.** Anyone who holds a push token can push
   any text to a minor's phone under the app's name.
4. **A5-04:** **One session can register any number of push tokens**, and each reminder is sent
   one Expo request per token, in sequence. That gives cost and quota amplification. Proven
   (20 tokens → 20 sends).
5. **A5-05:** A push token moves to **whoever registers it last**, with no proof of possession.
   Proven: the attacker's reminders reach the victim's phone, and the victim's own reminders stop.

## 2. Attack surface map

Public, unauthenticated, and reached by anyone:
- `POST /api/auth/request-pin` and `verify-pin` (paid SMS; per-number, per-IP and global limits;
  audited in A1)
- `GET/POST /api/consent/[token]` (guardian links)
- `POST /api/messaging/[channel]/inbound` (HMAC-signed; **local mode only**: `providers !== 'local'`
  → 404, and production refuses local)
- `/api/dev/*` (404 unless local and not production)

Authenticated (cookie for the web, bearer for the app):
- chat (paid model calls; 60/h per learner)
- uploads (direct-to-S3 tickets or through the server; 20/day)
- reports, goal, exams, practice, what-i-need, rechecks, reminders (10/day), messaging opt-in,
  push-token (20/h)
- export and delete

Out of band: the job runner (`reminder.send` and `receipt.check`, IDs only) and Expo's push
service.

An attacker goes for three things:
- **SMS cost and availability**, through the shared budget
- **Learner impersonation or lock-screen phishing** through push tokens
- **Opt-out integrity**, through forged or missing STOP

**Explicitly out of scope or not applicable:**
- No SQL injection surface: Drizzle is parameterised, and the raw `sql` templates bind values.
- No server-side templating of user HTML: `dangerouslySetInnerHTML`, `eval` and `new Function`
  appear nowhere in apps/ or packages/.
- No email sending, so no header injection.
- No CORS: no route sets `Access-Control-Allow-*`, so a cross-site page can't send the
  `Authorization` header the bearer exemption relies on (it needs a preflight).
- No OTA update channel: `expo-updates` isn't a dependency, so there's no rogue-update path.
- No `AsyncStorage`: the session and the push token live in `expo-secure-store`,
  `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`.

## 3. Findings

| ID | Severity | Location | Finding | Why it matters | Fix |
|---|---|---|---|---|---|
| A5-01 | Medium | `apps/web/lib/server/services.ts:174-182`, `:238`, `:257`; `apps/web/app/api/auth/request-pin/route.ts:21-23` | One global SMS budget (`takeBudget('sms', …)`) is shared by sign-in PINs, guardian consent links and every reminder `SmsChannel` sends. Nothing is reserved for sign-in. | Reminder volume spends the budget that sign-in depends on. Each opted-in learner can be sent up to 1 a day and 7 a week, and the placeholder budget is 2,000 a day. An exam week with about 2,000 SMS-opted learners, or one burst of scheduled reminders, makes `request-pin` answer 503 `sms-unavailable` for everyone, including a learner whose PIN expired mid-application. It's an availability failure of the core journey that no attacker has to cause. **Proven:** with a budget of 7, the 7th PIN is refused because one reminder took a slot. On PINs alone it would have been allowed. | Give reminders their own budget name (`takeBudget('sms-reminders', …)`), or keep a reserved floor for `sms-auth` that reminders can't spend. Defer reminders (reschedule) rather than drop them when their budget is spent. Add a test: exhaust the reminder budget, and `request-pin` still sends. |
| A5-02 | Medium (becomes **High** the day an SMS or WhatsApp adapter is listed) | `apps/web/lib/server/sms-providers.ts:12`; `apps/web/app/api/messaging/[channel]/inbound/route.ts:58`; `apps/web/lib/server/messaging-providers.ts:25-30`; `packages/content/src/en.ts:479` | The inbound route 404s in live mode ("live providers bring their own routes"). But `SmsAdapterFactory` returns only an `SmsSender`, and `ChannelAdapterFactory` only a `MessageChannel`. Neither contract has an inbound or STOP half, and nothing makes live mode refuse an outbound channel that has no inbound path. The UI tells learners "Reply STOP to any message to turn that channel off at once." | On launch, a learner's STOP over SMS or WhatsApp would reach nothing. That makes the opt-out promise false (POPIA s69 direct marketing, ECTA s45, WhatsApp Business policy), and these are minors. Today no adapter exists, so it can't happen yet. Adding one SMS adapter makes it happen with no other code change. | Make each live adapter factory return `{ channel, inbound: { route verifier, parser } }`, run through the same contract as `verifyWebhook` (forged, stale, replayed or altered → refused; STOP → `receiveInbound`). Make `readConfig` refuse a live channel without one. Add a test: a live config with an SMS adapter and no inbound handler throws `ConfigError`. |
| A5-03 | Medium | `apps/web/lib/server/messaging-providers.ts:38-46`; `apps/web/lib/server/config.ts:248-252`; `packages/messaging/src/expo-push.ts:52-56` | `EXPO_ACCESS_TOKEN` (Expo's "enhanced push security") is optional, and production accepts `UF_PUSH_PROVIDER=expo` without it. Without it, Expo delivers a push from anyone who holds a token. | A push token becomes a send credential. Tokens sit in plaintext as the primary key of `push_tokens`, are in each learner's export, and live on the phone. Anyone with one (a database leak, a log, a backup, a shared phone) can put any title and body on a minor's lock screen, branded as UniversityFlow ("Your results changed, tap to log in at …"). That's targeted phishing of children. | In production, refuse `UF_PUSH_PROVIDER=expo` unless `EXPO_ACCESS_TOKEN` is set. Add to docs/store the step to turn on enhanced push security in the Expo dashboard. Add a test: `readConfig({…production, UF_PUSH_PROVIDER:'expo'})` without the token throws. |
| A5-04 | Medium | `packages/db/src/migrations/0008_push_tokens.ts:13-22`; `packages/db/src/store.ts:1252-1313`; `packages/messaging/src/reminders.ts:256-271`; `packages/messaging/src/expo-push.ts:100-110` | Nothing limits how many tokens one session (one phone) or one learner holds: there's no unique `session_id` and no count cap. Only registrations are rate-limited (20/h, so about 480 a day, without limit over time). Each reminder fans out to every token, **one Expo HTTP request per token, in sequence**, each with a 10 s timeout. | One learner can attach thousands of well-formed fake tokens. Each of their reminders then makes thousands of serial Expo calls inside one job. That can outrun the function's duration, and the job is then retried up to 3 times, re-sending to the tokens already done. It also eats the project's Expo rate limit, which delays every other learner's notifications. **Proven:** 20 tokens on one session → one reminder → 20 sends. | One token per session: `unique (session_id)`, and registering on a session replaces its token. Cap tokens per learner (say 5), oldest out. Batch Expo sends (up to 100 messages per request). Add a test: a second token on the same session replaces the first, and the 6th device evicts the oldest. |
| A5-05 | Low | `packages/db/src/store.ts:1279-1294`; `apps/web/app/api/me/push-token/route.ts:21` | Registering a token that another learner holds moves it, with no check that the caller's phone actually produced it. The design assumes tokens are secret. | Someone who learns another learner's token (A5-03 lists the ways) can register it. The victim's phone then gets the attacker's reminders, and the victim's own reminders stop arriving with nothing to show why (only a `push.token-moved` audit row). The lock-screen text is generic, so it leaks nothing personal. Tokens can't be guessed, so this is Low. **Proven** end to end. The intended case (a shared phone) is already covered by sign-out deleting the session and, through it, the token. | Refuse the move (409) while the current holder's session is still live. Or prove possession: send a silent push with a nonce that the app echoes back before the token is bound. Add a test: B registering A's token while A's session is live gets 409, and A still receives the push. |
| A5-06 | Low | `packages/messaging/src/webhook.ts:19-21`, `:30-43`; `apps/web/app/api/messaging/[channel]/inbound/route.ts:66` | The HMAC covers `timestamp.body` only. It doesn't cover the channel in the URL, and nothing records which signatures were already used inside the 5-minute window. | A captured signed request replays as-is for 5 minutes. It also replays **on the other channel**: an SMS STOP posted to `/whatsapp/inbound` opts the learner out of WhatsApp, and a reply opens a WhatsApp 24-hour window that the learner never opened (a WhatsApp policy breach). It's Low because the route only exists in local mode, and replaying needs a captured request. It matters because the file says live verifiers must follow "the same contract". **Proven:** the same request was accepted twice on SMS and once on WhatsApp, and WhatsApp went to opted-out. | Sign `t.channel.body`, or put `channel` in the body and check it against the URL. Keep the HMACs seen within the tolerance window (the `rate_events` table or a small `webhook_seen` table with a unique key) and refuse a repeat. Add a test: the same signed request twice → the second is 401; posted to the other channel → 401. |
| A5-07 | Low | `packages/db/src/migrations/0002_audit_hardening.ts:23-28`; `packages/db/src/messaging.ts:104-107`, `:317-349`; `packages/db/src/store.ts:456` | Adult re-consent at 18 (§8.1) is enforced only by the route guard (`isReady`). `uf_may_process` and the messaging gate check `consent_status in ('not-required','granted')` only. Someone whose guardian consented and who has since turned 18 still gets every scheduled reminder, and their data is still processed by jobs, until they re-consent. | Out-of-request processing doesn't follow the consent rule the app shows the learner. This is A11 territory, and it's minor because the guardian's consent was lawful when given. | Compute "needs adult consent" (date of birth + `granted`) inside `uf_may_process` and `mayMessage`, so the job pipeline drops with `no-consent`. Add a test: a learner with guardian consent turns 18 with a reminder scheduled → it's dropped `no-consent`, nothing is sent. |

### Proof for the Medium and Low findings (throwaway tests, now deleted)

All four ran over the real handlers with PGlite and the local stand-ins. File:
`apps/web/test/a5.audit-tmp.test.ts`, result `4 passed`.

1. **A5-06:** I signed `{"type":"message","from":<learner>,"text":"STOP"}` once with the
   configured secret. I posted it to `sms` (200), posted it to `sms` again (200), then posted it
   to `whatsapp` (200). The learner's `whatsapp` channel ended up `optedIn: false`.
2. **A5-05:** The victim registered `ExponentPushToken[victimtoken000001]`. The attacker then
   registered the same token (200), opted in to push and set a `reminder.check-in`. After the
   runner ran, `devChannels.push.to(victimToken)` held 1 message: the attacker's.
3. **A5-04:** I registered 20 distinct tokens on one bearer session (all 200) and set one push
   reminder. The runner then made 20 sends.
4. **A5-01:** I set `UF_SMS_BUDGET_PER_HOUR` and `UF_SMS_BUDGET_PER_DAY` to 7. Six sign-in PINs
   plus one SMS reminder spent the budget, and the next `request-pin` got
   `503 {"error":"sms-unavailable"}`. On PINs alone it would have been the 7th, within budget.

## 4. Checked and holding (Phase 4 focus)

- **Webhook verifier**
  - HMAC-SHA256 over the raw text, which is read once with `request.text()` and parsed only after
    verification.
  - `timingSafeEqual` on equal-length buffers; the regex forces 64 hex characters, so the lengths
    can't differ and throw.
  - The header is format-checked and capped at 300 characters, and the timestamp window is ±5 min.
  - The secret must be at least 32 characters, and the dev secret is refused when set
    explicitly. Production with no secret gets `null`, so the route 404s.
  - Body capped at 8 KB, by header and again by actual bytes.
  - STOP answers the same for unknown numbers (no account enumeration). The rate limit is keyed
    per sender and skipped for STOP. Nothing personal is logged.
- **Forged STOP:** impossible without the secret (unsigned, forged, altered and stale requests are
  all covered by the existing tests). Only the replay and cross-channel cases above remain.
- **Push-token routes**
  - POST needs a bearer and `requireReady`, and the database checks consent again
    (`#mayProcessIn`, RLS `push_tokens_consented_self`).
  - The `uf_push_token_own_session` trigger stops a token being tied to another learner's session.
  - DELETE is limited to the learner's own token (`studentId` filter), with or without consent.
  - Sign-out deletes the session, and the cascade removes its token. Opting out of push deletes
    every token. Account deletion cascades.
  - The app routes a tapped notification only to a screen on a fixed list
    (`apps/native/lib/push.ts:142-147`).
- **New routes:** all 14 changed routes use `requireReady`/`requireSignedIn`. Path params are
  checked by regex or UUID (`what-i-need`, `documents/[id]`, `uploads/[id]`) and act only through
  the learner's own `StudentStore`. Bodies are `.strict()` zod schemas. Reminders accept only
  templates marked learner-schedulable, at most 60 days ahead, 10 a day.
- **CSRF:** `assertSameOrigin` on every cookie write. Refusals for a "null" or unparseable Origin,
  a cross-site cookie request, and the native pre-auth rule (gotcha 26) are tested. A bearer can't
  be forged cross-site without CORS, and none is configured.
- **Job pipeline:** payloads are exactly the declared `*Id` fields, each a lower-case UUID. This is
  checked by type, at schedule and at run, and by a database check constraint. Idempotency keys
  refuse runs of 7 or more digits. Every send re-checks consent, opt-in, cadence and quiet hours
  under a per-learner advisory lock.
- **Uploads**
  - Size is checked before the body is read.
  - Magic bytes are checked twice on the direct path (first bytes, then the whole file).
  - An accepted file is copied to a fresh server-chosen key, and each intent is claimed once, per
    learner.
  - The app sends `credentials: 'omit'` to S3 with a fixed file name (no personal data), and
    deletes its cached photo afterwards. `programmeId` is `encodeURIComponent`-ed before it goes
    into an API path.
- **Production refuses stand-ins:** `readConfig` throws in production unless `UF_PROVIDERS=live`,
  a real `AUTH_SECRET`, Postgres, `cpt1` and S3 in af-south-1 with no custom endpoint are all in
  place. Live mode has no fallback for SMS, jobs or AI. `/api/dev/*` checks `config.production` as
  well as the stand-in's presence.
- **Headers (from config):**
  - nonce CSP with `strict-dynamic` and no script `unsafe-inline`
  - `frame-ancestors 'none'`, `object-src 'none'`
  - HSTS with preload, `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`
  - `Permissions-Policy` allows only `camera=(self)`, which the report photo needs
  - `poweredByHeader: false`
- **Errors:** the handler returns a code and a reason only. A 500 logs just the error name, and
  `UF_DEBUG_ERRORS` is ignored in production.
- **Secrets:** only `.env.example` is tracked. `git log --all -S "sk-ant-"` and
  `-G "AKIA[0-9A-Z]{16}"` find nothing. `app.config.ts` holds no secret (the EAS project id isn't
  one).
- **`pnpm audit --prod`:** 3 moderate, plus 2 high ignored by GHSA id (A8-01, accepted). One of the
  moderates, `decode-uri-component`, comes in via `expo-router > query-string` and **ships in the
  app**: a crafted `universityflow://` link could hang the app's link parsing on the victim's own
  phone (self-DoS only). Left to A8; noted here for reachability.

## 5. Not measured

| Check | Why |
|---|---|
| Live response headers, HTTPS redirect, CORS on a deployed origin | No deployment exists, and the brief forbids builds and servers this run. Read from `next.config.ts`, `proxy.ts` and `lib/csp.ts` only |
| Secrets in the built client bundle and the app's JS bundle | Builds were forbidden this run (nine concurrent reviewers) |
| Full-history secret scan with gitleaks | gitleaks isn't installed locally. CI's Secret scan job runs it over the whole history. Only targeted `git log -S/-G` patterns were run here |
| 1,000 requests a minute against any endpoint | No server run allowed. Limits were confirmed by reading the code and by the existing integration tests |
| Real provider webhooks (Meta signature, SMS gateway), real Expo push with and without an access token | No live adapter or account exists (D8) |
| Device checks: Android `allowBackup` in the merged manifest, deep-link handling on a phone, secure-store backup exclusion | The app has never run on a device. The config was read only |
| Agent prompt injection (overlay surface 1) | Not re-run here: A10 owns it with the 118-case red team. Code read only: tools act through the learner's own `StudentStore`, and the crisis check runs before the model |

## 6. Waived

None.

## 7. Remediation roadmap

- **Quick wins (< 1 day):**
  - A5-03: production refuses Expo push without `EXPO_ACCESS_TOKEN`.
  - A5-01: a separate budget name for reminders, or a reserved floor for sign-in.
  - A5-04: `unique (session_id)` plus a per-learner cap of about 5 tokens.
  - A5-06: bind the channel into the signature.
- **Medium:**
  - A5-06: a replay cache for webhook signatures.
  - A5-04: batched Expo sends.
  - A5-07: adult re-consent in `uf_may_process` and `mayMessage` (a migration).
  - A5-05: refuse a token move while the holder's session is live.
- **Structural (before any live messaging adapter is listed):**
  - A5-02: make inbound or STOP handling part of every live channel adapter's contract and of
    `readConfig`'s refusal rules.

## 8. What's genuinely good

- **The webhook verifier is right where it usually goes wrong:**
  - it verifies the raw text before parsing
  - the compare is constant-time and can't throw on a length mismatch
  - the window is bounded
  - the secret has a minimum length, and the dev secret is refused
  - STOP never reveals whether a number has an account
- **Consent is enforced in the database, not just the route.** RLS plus `uf_may_process` on
  `push_tokens`, `reminders` and `messaging_channels`. A second, last-moment `RecipientGate` runs
  inside every channel. Hard rule 5 holds even for the job runner.
- **Hard rule 4 is made mechanical.** Job payloads are branded UUIDs checked three ways. Push
  bodies are variable-free templates. Errors from Expo never quote the token. Rate-limit keys are
  HMACs.
- **Production fails closed.** Stand-ins, the dev outbox, dev routes, preview catalogue data, a
  weak `AUTH_SECRET`, a non-`cpt1` region or a non-af-south-1 bucket each stop the server from
  starting.
- **The native client is careful.** The token is in the Keychain or Keystore, it's
  `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, and the app sends `credentials: 'omit'`. Notification
  taps only open screens on a fixed list. Report photos are deleted from the cache after upload.
  Nothing personal goes in file names.
- **Sign-out removes push server-side through the session foreign key**, so a phone that's
  offline or uninstalled still stops receiving.
