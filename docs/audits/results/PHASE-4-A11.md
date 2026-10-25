# PHASE-4 — A11 Privacy and POPIA

**Project:** UniversityFlow · **Phase:** 4 · **Date:** 2026-10-14
**Commit:** 7d53bc6 · **Audit source:** docs/audits/A11-privacy-popia.md @ 7d53bc6
**Result:** ❌ Fail: 0 Critical · 1 High · 6 Medium · 4 Low (11 findings, A11-01 to A11-11). The High (A11-01) shuts the Phase 4 gate.

Scope: the Phase 4 diff `git diff 17ca607..7d53bc6` (#20 to #34). That covers messaging opt-in per
channel and STOP (migration 0005), reminders and the job pipeline (`packages/jobs`,
`packages/messaging`, `packages/db/src/messaging.ts`), push tokens (migration 0008) and the Expo
push adapter, camera upload in `apps/native`, account deletion and export of the new tables,
goals and exam choices (0006), and re-checks (0007). This was an independent, read-only review.
Five throwaway probes ran on PGlite in `packages/db` (`a11-phase4.audit-tmp.test.ts`, 5/5 passed,
which confirmed each behaviour described below). The file was deleted afterwards.

## Executive summary

The engineering of Phase 4's privacy controls is strong:

- Job payloads are IDs only, checked twice (in the types and by a database `CHECK`).
- Reminder params are catalogue ids only (`uf_reminder_params_ok`). Re-check moves can't carry
  marks (`uf_recheck_moves_ok`).
- Every new learner table has RLS plus `uf_may_process`.
- Consent, opt-in and cadence are re-checked at send time inside one locked transaction, and the
  channel checks again at the last moment.
- Push sends a variable-free `pushBody`, the app's name and a screen word, and nothing else.
- Tokens hang off sessions and are removed at sign-out, opt-out, withdrawal (sessions are
  deleted), deletion and `DeviceNotRegistered`.
- Deletion purges the job queue in the same transaction.
- No new log line carries personal data.

What fails is mostly the **legal layer around messaging**, plus **retention**:

1. **The guardian consent (v1-2026-10) says nothing about messaging (A11-01, High).** It doesn't
   mention reminders by SMS, WhatsApp or app notification, or that they pass through Expo, Apple,
   Google, Meta or an SMS provider outside our control. planning.md §7.1 relies on that consent
   to cover messaging for minors. The wording and version did not change in Phase 4.
2. **SMS and WhatsApp minimise less than push (A11-02).** Push was carefully minimised for the
   lock screen and the cross-border hop, but SMS and WhatsApp bodies still carry the learner's
   first name and the university or subject. They go to an SMS provider and (when connected)
   Meta, and show on a lock-screen preview just the same.
3. **Retention (A11-03, A11-04, A11-07).** Nothing is ever pruned:
   - push tokens on expired sessions;
   - sent, dropped and failed reminders with their receipts;
   - finished jobs;
   - `last_inbound_at`.
4. **Withdrawal (A11-05).** A guardian withdrawal leaves channel opt-ins on. A later consent,
   even from a *different* guardian, silently resumes messaging.

## Findings

| ID | Severity | Location | Finding | Why it matters | Fix | Test that fails without the fix |
|---|---|---|---|---|---|---|
| A11-01 | **High** | packages/content/src/en.ts:145-177 (`consent.*`, `version: 'v1-2026-10'`); en.ts:478, en.ts:652 | The guardian consent lists what UniversityFlow does and where data goes, but says nothing about reminders by SMS, WhatsApp or app notification. It also doesn't say that those pass through an SMS provider, Meta (WhatsApp), or Expo (US) and then Apple or Google. The learner's opt-in screens (`me.messages.lead`, `notifications.lead`) don't name the processors either. The consent version was not bumped when Phase 4 added the purpose. | POPIA ss 18, 34-35 and 72. Consent must be specific and informed, and §7.1 says "for under-18s, parent or guardian consent covers it", but this consent doesn't. Push and WhatsApp are cross-border transfers of a minor's data (the token, the number, the message) that the consent text never names. Check 8 requires this disclosure. | (1) Add a "Reminders" bullet to `consent.whatWeDo`. (2) Add a `whatWeKeep` line naming the SMS provider, WhatsApp (Meta) and app notifications (Expo, Apple, Google, outside South Africa), in words a 16-year-old understands. (3) Bump `consent.version` to v2. (4) Enforce this in the data layer: for a learner whose consent came from a guardian, `setChannelOptIn(…, true)` refuses unless the granted `guardian_consents.consent_version` is at least v2 (a re-consent prompt asks for it). (5) Add one sentence about the processors to `me.messages.lead` and `notifications.lead`. (6) The legal review (A11-10) covers the final wording. | Content test: `consent.whatWeKeep.join(' ')` matches `/Expo/`, `/Apple/`, `/Google/` and `/WhatsApp/`. DB test: a minor granted under `'v1'` calls `setChannelOptIn('sms', true)` and expects a rejection. Both fail today. |
| A11-02 | Medium | packages/content/src/messages.ts:78, 88, 98, 112 (bodies use `{firstName}`, `{universityName}`, `{subjectName}`); packages/db/src/messaging.ts:139-151; apps/web/lib/server/reminders.ts:33-46; docs/store/privacy-and-data-safety.md:45 | SMS and WhatsApp reminders go out as "Hi Lebo, your University of the Witwatersrand application is on your list…" (probe P4). That is the learner's name plus where they apply, handed to the SMS provider and (when connected) Meta, and shown on any lock-screen SMS or WhatsApp preview. The reasons `pushBody` was made variable-free (the lock screen and the cross-border hop) apply equally here. The store privacy page says the SMS provider gets "the reminder text" without saying it includes the name and university, and it doesn't mention WhatsApp or Meta at all. | s10 minimisation and s72 cross-border. A minor's choice of university is disclosed to anyone near the phone and to processors that don't need it. | Make SMS and WhatsApp bodies as variable-free as `pushBody`: drop `firstName`, or make it a learner opt-in, and keep the catalogue names in the app ("an application on your list has something left to do"). If the names stay, justify each in the minimisation table and disclose it in the consent and privacy pages. Add WhatsApp (Meta) to the "Processors outside South Africa" list. | `messages.test.ts`: for every template, `renderMessage(id, {firstName:'Lebo', universityName:'Wits…', subjectName:'Life Sciences'}, 'sms')` contains none of those values. Fails today (P4). |
| A11-03 | Medium | packages/db/src/migrations/0008_push_tokens.ts:11-16; packages/db/src/store.ts:78, 439-441; packages/db/src/messaging.ts:161-169 | Tokens are deleted only when their session row is deleted (sign-out or withdrawal). Expired sessions are never purged, so the token of a learner who just stops using the app is kept forever. Probe P1: 400 days after registration the token is still in `push_tokens` and still in the export, though it is never used (`mayMessage` is false). | s14 retention. The brief (check 8) says the token is "tied to the session". In practice it outlives the session indefinitely. A device identifier for a minor is kept with no purpose. (Side effect: the app still shows "on for this phone" while nothing arrives.) | Add a scheduled sweep (a job kind, IDs only) that deletes expired sessions (tokens cascade), or deletes `push_tokens` whose session is expired, daily. Also have the app re-register its token after a fresh sign-in. | P1 rewritten as a test: register a token, advance 31 days, run the sweep, expect `push_tokens` to be empty for that learner. Fails today: there is no sweep and the row remains. |
| A11-04 | Medium | packages/db/src/migrations/0005_messaging.ts:48-70 (reminders), 17 (`last_inbound_at`); 0004_jobs.ts:25-39 (jobs); planning.md §8 (no retention rule) | Nothing prunes Phase 4's operational data: reminders in `sent`, `dropped` or `failed` (with `receipt_id`, `delivery_status`, `sent_at`); `jobs` rows in `done`, `failed` or `cancelled`; `last_inbound_at` (needed only for 24 hours); `rate_events` rows for the new `reminder`, `push-token` and `inbound-*` keys. All of it lives until the account is deleted. planning.md has no retention schedule at all. | s14. Records are kept no longer than necessary for the purpose. The cadence needs 8 days of sends (`SEND_LOOKBACK_MS`), the WhatsApp window 24 hours, and Expo receipts 1 day. | Write a retention schedule into planning.md §8 (owner decision). Implement it as one sweep job: delete terminal reminders after N days (more than 8), finished jobs after 7 days, rate and budget events beyond their window, and null `last_inbound_at` after 24 hours. Then export what remains. | Insert a reminder `sent` 60 days ago and a `done` job, run the sweep, and expect both gone. Fails today: there is no sweep. |
| A11-05 | Medium | packages/db/src/store.ts:590-617 (`withdrawConsent`) | Withdrawal ends sessions (tokens go) and pending reminders get dropped at send time (`no-consent`). But `messaging_channels.opted_in` stays true. Probe P3: a guardian withdraws, then a *different* guardian consents (to a request that doesn't mention messaging, see A11-01), and `mayMessage('sms', phone)` is true again with no new opt-in from the learner. | ss 11(2)(b) and 34-35. Withdrawal must stop processing, and the new competent person never chose messaging. The opt-in is personal data collected under a consent that has ended. | In the withdrawal transaction, set every `messaging_channels` row to `opted_in=false, opted_out_at=now` with a new `opt_out_source` value `'consent-withdrawn'` (an append-only migration widens the CHECK), and mark scheduled reminders `dropped/no-consent`. | P3 as a test: after withdrawal and a new grant, expect `mayMessage('sms', phone)` to be `false` until `setChannelOptIn` runs again. Fails today. |
| A11-06 | Medium | apps/web/lib/server/messaging-providers.ts:38-45; packages/messaging/src/expo-push.ts:52-56 | `EXPO_ACCESS_TOKEN` is optional. Without Expo's "enhanced push security", anyone who holds a learner's token can send any title and body to that minor's phone under UniversityFlow's name, bypassing every template, cadence and quiet-hours rule. Tokens leave the server in the data export, can be seen on the device, and sit with Expo. | s19 safeguards. A spoofed "UniversityFlow" notification to a 16-year-old ("your NSFAS application failed, tap here…") is a phishing vector the product's own rules can't stop. | In live mode with `UF_PUSH_PROVIDER=expo`, `readConfig` requires `EXPO_ACCESS_TOKEN` (`ConfigError` otherwise). Add a release-checklist line for the owner to turn on enhanced push security in the Expo project. | `config.test.ts`: `readConfig({ …live, UF_PUSH_PROVIDER:'expo' })` without `EXPO_ACCESS_TOKEN` throws. Fails today (accepted, with `accessToken: null`). |
| A11-07 | Low | packages/messaging/src/reminders.ts:256-264, 290-302; packages/messaging/src/expo-push.ts:141-148 | When a learner has several phones, each gets a ticket, but only the **first** ticket is stored (`receiptId ??=`) and checked. A `DeviceNotRegistered` receipt for any other phone is never fetched, so that token is never forgotten. Probe P2: phone A's receipt says it's gone, and its token stays. | s14 and check 8 ("forgotten when Expo says the device is gone"). A dead device identifier is retained and keeps getting sends. | Keep every ticket for a send (a `reminder_receipts` child table, or an array column), and have `receipt.check` ask Expo for all of them. Tickets are ids only. | P2: two phones, the second ticket's receipt is `DeviceNotRegistered`, then expect that token to be gone. Fails today. |
| A11-08 | Low | packages/db/src/messaging.ts:372-394; packages/db/src/store.ts:1467-1492 | STOP from a minor *without* consent writes a `messaging_channels` row as the owner, outside the RLS and consent gate (probe P5). That is deliberate: an objection is always honoured. But the legal basis isn't written down anywhere hard rule 5 is discussed, and `exportAll` returns `personal: null` without consent, so the learner can't see the record that's held about them. | Hard rule 5 says "nothing about a minor is processed before guardian consent". This is a justified exception (s11(3) objection), but an undocumented one, and export (s23) misses it. | Document the exception (an objection is recorded so it can be honoured) in planning.md §8.1 and the A11 brief. Return `messaging_channels` opt-out rows in the export's `account` part regardless of consent. | P5: `exportAll()` after a pre-consent STOP should contain the `stop` record. Fails today. |
| A11-09 | Low | packages/content/src/messages.test.ts:136-140 | The "no catalogue name on a lock screen" test uses a hard-coded list (`wits\|uj\|up\|uct\|tut\|ukzn\|university of\|mathematics\|physical sciences\|hi `). A `pushBody` that said "Life Sciences", "Stellenbosch", "NSFAS" or "Dear Lebo" would pass. | Check 8 says "a test fails if one gains … a catalogue name". The test only covers the names someone remembered to type. | Move the assertion to `packages/messaging` (it depends on content and catalogue) and derive the forbidden words from `UNIVERSITIES` names and short names and from `SUBJECTS` names, plus a greeting pattern. | Change a `pushBody` to "A little Life Sciences practice today" and run the current test: it passes, but should fail. |
| A11-10 | Medium (owner, launch blocker) | status.md:41 (mentioned in prose only, not in Open findings) | Check 7 is not done: no Information Officer is registered with the Information Regulator, and no lawyer has reviewed the guardian consent wording (now including messaging and push, A11-01). The brief requires each to be recorded as an open finding owned by the owner. Neither was in the Open findings table. | s55 and the regulations: an Information Officer must be registered before processing starts. A consent the law doesn't recognise means unlawful processing of minors' data. | Owner: register the Information Officer, commission the legal review of `consent.*`, the privacy policy and the store privacy page, and close this with the dates. | Not a code fix. The phase gate tracks it through the table. |
| A11-11 | Low | packages/db/src/store.ts:1439-1450; apps/web/app/api/me/route.ts:40 | `scheduledJobIds()` returns only reminders in `scheduled` or `sending`, so on account deletion a hosted scheduler (Trigger.dev, not connected, likely outside SA) still holds `receipt.check` jobs for `sent` reminders, plus finished jobs, for up to about 30 minutes or for its own retention. They carry the reminder's id only (no personal data), and the local queue is purged correctly. | Deletion should reach every processor. The impact is small because the payload is IDs only. | Record `receipt.check` job ids on the reminder (or derive them from the idempotency key `receipt:<id>`) and cancel them too. Check the hosted scheduler's run-history retention when it is connected. | A memory scheduler test: send a reminder, delete the account, and expect `scheduler.get(receiptJobId)` to be cancelled. Fails today. |

## Not measured

- **Real log output (check 3).** There is no deployed environment yet, so this audit searched the
  code. Only three `console.*` calls exist: `http.ts:83` logs the error name only, `budget.ts:53`
  logs counts, and `reports/route.ts:45` logs the error name. None carry personal data. A sample of
  real Vercel or Sentry logs is owed once something is deployed.
- **Live Expo, APNs or FCM traffic, and the device lock screen.** Verified only through the
  adapter and its fake `fetch`. What Apple and Google keep (delivery records) is per their terms.
- **WhatsApp.** There is no live adapter (`WHATSAPP_ADAPTERS = {}`). Its disclosure and the Meta
  transfer are covered under A11-01 and A11-02 before one is connected.
- **Hosted scheduler (Trigger.dev) region and retention.** Not connected (D8).
- **Photo metadata on device.** The native picker re-encodes at quality 0.8 with `exif: false`,
  and the server strips all metadata before the AI sees it (`images.ts`). But the **stored
  original** in S3 is not re-encoded on the server: web uploads in particular keep their GPS EXIF,
  and PDFs (with their author metadata) pass to the AI unchanged. The store page says "Not
  collected: location". Recommend stripping on ingest, not only before reading. This was not
  proven on a device, so it is not raised as a finding.
- **Residency config (check 4).** Covered by A1-06 (`cpt1` pinned, S3 region required as
  af-south-1). Not re-tested here.
- **Real Postgres.** The probes ran on PGlite, the same engine the db suite uses by default.

## Waived

None. A11-08 (STOP before consent) is a justified exception to hard rule 5, but it is raised as a
documentation and export gap rather than waived, because the exception is written down nowhere.

## Remediation roadmap

1. **Before Phase 4 closes (gate):**
   - **A11-01:** consent wording v2 naming messaging and its processors, plus the data-layer
     version check for minors' opt-ins.
   - **A11-05:** withdrawal resets opt-ins.
2. **Before any live messaging provider is connected:**
   - **A11-02:** variable-free SMS and WhatsApp bodies, or a justified and disclosed exception.
   - **A11-06:** require `EXPO_ACCESS_TOKEN`.
   - Update docs/store/privacy-and-data-safety.md (WhatsApp and Meta; what the SMS provider gets).
3. **Retention, as one sweep job (Phase 4 or early 5):**
   - **A11-03:** expired sessions and their tokens.
   - **A11-04:** terminal reminders, finished jobs, `last_inbound_at`, rate events.
   - **A11-07:** check every push ticket.
   - The owner writes the retention schedule into planning.md §8.
4. **Small fixes:**
   - **A11-08:** export the STOP record and document the s11(3) basis.
   - **A11-09:** derive the lock-screen test's words from the catalogue.
   - **A11-11:** cancel `receipt.check` jobs on deletion.
5. **Owner, before launch: A11-10.** Information Officer registration and the legal review.

## What's genuinely good

- **IDs-only payloads, enforced three times.** The types (`defineJobKind`), the application
  (`validateJobPayload`), and the database (`uf_job_payload_is_ids` CHECK). Reminder params and
  re-check moves have their own CHECK functions, so marks, names and free text physically can't
  enter those columns.
- **Send-time re-checks under one advisory lock.** Consent (`uf_may_process` as `uf_app`),
  opt-in, the cadence and quiet hours are all checked there, then the channel's `RecipientGate`
  checks once more immediately before the provider. A STOP that arrived a second ago still wins.
- **Push minimisation done properly.** There is a separate `pushBody` with no variables. The title
  is the app's name, `data.screen` comes from a fixed list, and the app ignores anything else
  (`routeForNotification`). Expo's error text, which quotes the token, never reaches an error
  message.
- **Push token lifecycle.**
  - Behind RLS and consent, with a trigger stopping a token from being bound to another learner's
    session.
  - Moved, not shared, when someone else signs in on the phone.
  - Deleted at sign-out, opt-out, withdrawal, account deletion and `DeviceNotRegistered`.
  - Exported without the session id.
  - On the phone, held in SecureStore `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`.
- **Deletion purges the job queue in the same transaction** as the account, and every new table
  cascades. Export covers every new learner table: goal, exam choices, re-checks, channels,
  preferences, reminders and push tokens.
- **The inbound webhook.** It is HMAC-signed and replay-protected. The rate-limit key is an HMAC,
  never the number. The STOP reply is the same whether or not an account exists, so the endpoint
  can't be used to find out who uses UniversityFlow. Nothing is logged.
- **Camera upload.** It uses a fixed file name (`report.jpg`) so the learner's own file name can't
  identify them. The app's cached copy is deleted after upload, and the gallery is never touched.
  The camera permission is asked only on tap.
- **Opt-out and removal are always allowed.** `removePushToken` works after consent has been
  withdrawn.
