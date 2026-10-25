# PHASE-4 — A12 Messaging compliance

**Project:** UniversityFlow · **Phase:** 4 · **Date:** 2026-10-14
**Commit:** 7d53bc6 · **Audit source:** docs/audits/A12-messaging.md @ 7d53bc6
**Result:** ❌ FAIL — 2 High, 7 Medium, 6 Low (15 findings). Phase 4 can't close until A12-01 and A12-02 are fixed with tests that fail first.

Scope: `git diff 17ca607..7d53bc6`: packages/messaging (channels, cadence, quiet hours, STOP, webhook,
budget, expo-push, reminders), packages/db/src/messaging.ts and papers.ts, packages/jobs,
apps/web inbound webhook and reminder/messaging/guardian routes, packages/content message
templates, apps/native/lib/push.ts. This is A12's first run. Report only: no product code changed.

## Executive summary

Most of the "never" properties are well built. Consent, opt-in and cadence are checked again at
send time in one transaction with a per-learner advisory lock. A second opt-in check (`RecipientGate`)
runs just before the provider call. Quiet hours hold to the millisecond in Africa/Johannesburg. The
60-before/30-after paper margins hold at the boundary minutes. Push bodies carry nothing personal,
and webhooks are HMAC-signed with a constant-time compare. I tried all of these with throwaway tests
and couldn't break them.

**"Nothing during a paper" does fail in production, though, and doesn't hold as a property.** The
paper source reads the catalogue *view*, which leaves out unverified papers in production. No papers
are verified, so a Grade 12 learner writing Mathematics P1 (2026-10-23 09:00) has no paper slots,
and a reminder due at 09:30 goes `now` (A12-01). Exam-year detection makes it worse: a learner who
signed up in Grade 11 and never updated their profile is protected in the wrong year (A12-02), and
a learner with no confirmed report has no papers at all (A12-03). Meanwhile the UI promises "never
during a paper". The existing six-week simulation passes because it injects papers directly and
bypasses the catalogue view.

The other findings are about opt-out reach (unknown-number STOP not recorded, natural phrasings
missed), retry double-sends, and SMS cost: every template is UCS-2 because of a curly apostrophe,
which doubles the segments. Reminders and PINs also share one budget, and one template is likely to
be recategorised as marketing.

## Findings

| ID | Severity | Where | Finding | Why it matters | Fix | Proof (failing test) |
|---|---|---|---|---|---|---|
| A12-01 | **High** | packages/db/src/papers.ts:31-41 (fed by apps/web/lib/server/services.ts:146 → packages/catalogue/src/catalogue.ts:90) | Paper protection uses only **verified** papers. In production `catalogueView(..., {includeDrafts:false}).examPapers` is `[]` (asserted by exams.test.ts:95), so `slotsFor` returns nothing and `nextAllowedSend` answers `now` mid-paper. Probe: Grade 12, Mathematics, 2026-10-23 09:30 SAST → `{kind:'now'}`. With drafts → `later` | A message during a paper breaks the Phase 4 definition of done, and contradicts the promise in packages/content/src/en.ts:478 and :653. Hard rule 3 governs what a learner is *shown*. Using a draft date only to stay *quiet* can't mislead anyone | Build `TimetablePaperSlots` from every sourced paper (drafts included), e.g. `RAW_CATALOGUE.examPapers` or a `catalogue().allExamPapersForSuppression`. Suppression is fail-safe. Keep drafts out of anything displayed. Add a guard comment saying suppression must never filter on verification | In packages/db: `TimetablePaperSlots(inputs(12,['mathematics']), () => <production source>)`, then `nextAllowedSend` at 2026-10-23T07:30Z, expecting `kind:'later'`. It fails today. Also an apps/web services-level test with `catalogueDrafts:false` |
| A12-02 | **High** | packages/catalogue/src/exams.ts:85-101, used at packages/db/src/papers.ts:36 | The exam year comes from the **profile grade**. For the first cohort (Grade 11 in 2026), a profile still saying 11 in 2027 gives `nscExamYear(11, 2027) = 2028`. Their real Nov 2027 papers aren't matched unless they confirmed a `grade-12-*` report. Probe: grade 11 + Mathematics, during a 2026 paper, drafts on → `[]` → `now` | This is the cohort the product launches for. A learner who skips uploading June/September reports gets messages during matric | For suppression, take the union of the years for `grade` and `grade+1` (staying quiet is never harmful). Better: store the year the grade was given and advance it each January (status.md already lists "consider asking learners each January") | `slotsFor` with `grade:11`, subjects `['mathematics']`, during the matching NSC paper of year Y while the profile was set in Y-1, expecting ≥1 slot. It fails today |
| A12-03 | Medium | packages/db/src/papers.ts:34 and packages/catalogue/src/exams.ts:115-125 | With **no confirmed report** (or every subject removed), `examSubjects` is empty, so there are no papers and no protection. Probe confirmed `[]` | planning.md §7.2 says "we know the timetable". A Grade 12 learner without a confirmed report still writes papers | When the subject set is empty and the learner is in their exam year, suppress across every NSC session slot for that year (the morning and afternoon windows of each exam day) | `slotsFor` for grade 12 with `[]` subjects during any NSC paper, expecting ≥1 slot |
| A12-04 | Medium | apps/web/app/api/messaging/[channel]/inbound/route.ts:92-99; packages/db/src/messaging.ts:371; apps/web/app/api/me/guardian/route.ts:22 | A STOP from a number **with no account** (e.g. a guardian sent the consent SMS) gets "You won't get any more UniversityFlow messages here" but **nothing is recorded**. The next consent request (per-student limit, a new day, or another learner) SMSes that number again. The guardian SMS also ignores quiet hours | The confirmation is false. WhatsApp policy says "respect all requests … to opt out", and SA practice (ECTA s45 / CPA s11) expects a STOP to be honoured. A parent can get a UniversityFlow SMS at 23:00 | Keep a suppression list keyed by HMAC(number) (no plain number, hard rule 4), written on any STOP and checked before every outbound SMS/WhatsApp, guardian SMS included. Hold guardian SMS outside quiet hours, or queue it until 07:00 | Signed STOP from an unknown number, then `POST /api/me/guardian` with that number, expecting no SMS in the outbox. Also a guardian request at 22:00 SAST, expecting it queued |
| A12-05 | Medium | packages/messaging/src/stop.ts:43-65 | STOP matching misses natural opt-outs: "Please stop", "please stop messaging me", "Remove me", "No more messages", "unsub", "Don't message me", "Asseblief stop" all return `false` (probe) | The header comment says matching is "deliberately generous". WhatsApp's Business Messaging Policy requires honouring *all* opt-out requests, on or off WhatsApp | In short messages (≤ ~8 words), match STOP/UNSUBSCRIBE/UNSUB as a word anywhere. Add phrases (REMOVE ME, NO MORE, DON'T MESSAGE/TEXT ME, plus first-language equivalents once reviewed). Over-matching is safe | `isStopMessage('Please stop')` and the others above, expecting `true` |
| A12-06 | Medium | packages/messaging/src/reminders.ts:272-278; packages/messaging/src/channel.ts:212-218 | Every provider exception is retried, **including ambiguous ones** (timeout or connection drop after the provider took the message). Probe: a sender that delivers and then throws → attempt 1 releases, attempt 2 sends again → **2 deliveries** of one reminder | "Retries never double-send" is in scope. A duplicate also spends a second cadence slot's worth of attention and SMS money | Split `ChannelSendError` into definitely-not-sent (HTTP 4xx/5xx before acceptance, connection refused) and maybe-sent (timeout/abort after the request was written). On maybe-sent, mark the reminder `sent-unconfirmed` and don't retry. Pass a per-reminder idempotency/client reference to providers that support one | Handler test with a sender that records and then throws on the first call. Run attempts 1 and 2, expecting exactly one delivery |
| A12-07 | Medium | packages/content/src/messages.ts:78, 88, 98, 112 (and `SMS_MAX_LENGTH`, packages/messaging/src/sms.ts:28) | Every template body contains `’` (U+2019), which isn't in GSM-7, so every SMS goes out **UCS-2** (70/67 characters per segment). Measured: check-in 90 chars, study 100, application 129, recheck 128 → **2 segments each instead of 1**. The "three segments" test (messages.test.ts:68) counts 480 characters, not encoded segments | This doubles the SMS cost of every reminder (§7.4). A non-GSM first name (e.g. one with `ŋ` or an emoji) does the same | Use ASCII `'` in SMS bodies, or GSM-7-normalise on the SMS channel. Count segments by encoding (GSM-7 160/153, UCS-2 70/67) and limit to 1 segment where possible | Content test: for every template on `sms`, with max-length variables, assert every character is GSM-7 and the text is ≤160. It fails today on `’` |
| A12-08 | Medium | apps/web/lib/server/services.ts:174-182, 238; packages/messaging/src/budget.ts:97; packages/messaging/src/reminders.ts:273-280 | One global SMS budget (placeholder 300/h) is shared by **sign-in PINs, guardian consent SMS and reminders**. A 07:00 batch of 300 reminders exhausts it and every PIN fails closed until the hour rolls over (probe). The budget counts messages, not billed segments (probe: a 3-segment SMS takes 1). A budget refusal becomes a provider error: 3 quick retries (1, 2 min), then `failed` for good | Cost control and availability. Reminders can lock learners out of sign-in, and the budget understates spend by 2–3× | Separate budgets: an auth reserve and bulk reminders. Weight each `take` by segments. On `SmsBudgetExceededError`, reschedule the reminder after the window (`wait`), don't `fail` | 300 reminder sends, then a PIN send on the auth budget, expecting it allowed. Also a 3-segment body, expecting 3 units taken |
| A12-09 | Medium | packages/content/src/messages.ts:38, 72-82 | `reminder.check-in` ("Your plan has a next step waiting. Open the app to see it.") is generic and not tied to a specific request or transaction. Meta treats "unclear content … generic" and app-return prompts as **marketing** and recategorises approved utility templates automatically. `WhatsAppCategory = 'utility'` can't represent the recategorised state | Roughly a 12× cost difference (§7.4: R1.50 vs R0.12), plus Meta's per-user marketing frequency limits. Cost tracking would silently be wrong | Make the check-in body state the learner's own request ("This is the reminder you set: …"), as `reminder.study` does. Widen the type to `'utility' \| 'marketing'` and record the category Meta returns (template status webhook) for cost reporting | Content test that every template's WhatsApp body names a learner request or a specific account event (lint list), and a type test that a `marketing` category can be stored |
| A12-10 | Low | packages/content/src/messages.ts:72-117 (cf. en.ts:479) | No SMS or WhatsApp template tells the recipient how to opt out. "Reply STOP" appears only in the app's settings card | Best practice under WhatsApp policy and SA SMS practice. A learner who never opened settings doesn't know STOP works | Append "Reply STOP to stop." (GSM-7) to SMS bodies. WhatsApp: a quick-reply "Stop reminders" button on the template | Content test: every SMS rendering contains `STOP` |
| A12-11 | Low | packages/messaging/src/webhook.ts:30-43; inbound route.ts:66 | A captured signed request **replays freely for 5 minutes** (probe: same header verified at +4 min). There's no nonce or event-id store | A replayed `message` reopens the 24-hour window. A replayed `status` overwrites a delivery report. The route comment says "replayed … refused", which isn't true inside the window | Store a hash of `v1` (or the provider's event id) for the tolerance window and refuse repeats | Route test: the same signed body POSTed twice gets 200 and then 409/401 |
| A12-12 | Low | inbound route.ts:99 | The STOP confirmation is only returned in the HTTP response. Nothing sends it on the channel, and no live route exists yet. Nothing says the confirmation is exempt from cadence and quiet hours | §7.1 and the brief require STOP to be "confirmed". The live adapters will need this path, and it's easy to get wrong (blocked by quiet hours, or counted toward the cap) | Send the confirmation with `channel.sendText` (a reply inside the window), exempt from cadence and quiet hours. Add it to the channel contract | Contract test: inbound STOP at 22:30 SAST, expecting exactly one confirmation sent on that channel and no cadence slot used |
| A12-13 | Low | packages/content/src/messages.ts:78, 88, 98 | SMS and WhatsApp bodies put the learner's first name, a subject and a **university they're applying to** on the lock-screen preview. Push deliberately avoids all of this for exactly that reason | This is a minor's data on a lock screen, and it passes through the SMS/WhatsApp provider. A12 check 5: "no personal detail beyond what its purpose needs" | Drop `universityName` (and possibly `subjectName`) from SMS/WhatsApp bodies, or record an owner decision that the preview is acceptable | Content test that SMS/WhatsApp renderings contain no `universityName` value |
| A12-14 | Low | packages/messaging/src/reminders.ts:204; packages/db/src/messaging.ts:142-145 | If a runner dies between the claim (`sending`) and `recordSent`/`release`, the reminder stays `sending` forever. The retried job returns at once, the reminder is silently lost, and it holds a cadence slot | Not a double send (correctly at-most-once), but invisible. Receipts and reporting can't see it | A sweeper that turns `sending` older than the job lease into `failed` with reason `unknown-outcome` (never resend) | Claim, simulate a crash, advance past the lease, run the sweeper, expecting `failed/unknown-outcome` and no second delivery |
| A12-15 | Low | apps/web/lib/server/services.ts:193-241 | Only SMS has a global spend cap. WhatsApp (billed per message) has none, and budget alerts are still only a log line (A1-05) | Spend is bounded today only by learner count × the cadence cap. There's no early warning | A generic `MessageBudget` per paid channel with 80%/100% alerts routed to Sentry or a pager when connected | Budget test on a WhatsApp channel: the (limit+1)th send is refused |

## Not measured

- **Live providers.** No SMS or WhatsApp adapter exists (the registries are empty). The provider
  contract suite against a live adapter, Meta template approval, the real 24-hour window,
  SMS/WhatsApp delivery receipts and the live STOP routes can't be tested yet. Expo push runs only
  against a fake `fetch`.
- **Cost per student per month vs §7.4.** There's no traffic and no provider quote. Upper bound from
  the code: ≤2 messages/week normally and ≤7/week in an exam period (≤1/day), about 110–150 a year,
  in line with the plan's ~120. At UCS-2 (A12-07) each SMS costs 2 segments.
- **Racing runners on real Postgres.** I relied on the existing race test (messaging.test.ts:453)
  and didn't run the gated `TEST_DATABASE_URL` suite (PGlite serialises connections, so the race is
  only real on Postgres).
- **Non-English STOP words** need first-language review (already owed in status.md).
- **Push on a device** (never run on a phone).
- **Delivery latency at the 21:00 boundary.** A message claimed at 20:59:59 may land after 21:00 at
  a provider's discretion. Not a code defect.

## Waived

None.

## Remediation roadmap

1. **Before Phase 4 closes (High):** A12-01 (suppress on every sourced paper) and A12-02 (exam
   year union or January grade roll). Each needs a test that fails first, at the services level
   with production catalogue settings, not with injected papers.
2. **Before any live SMS/WhatsApp adapter is connected:** A12-04, A12-05, A12-06, A12-07, A12-08,
   A12-09, A12-12. They decide whether the provider choice is compliant and affordable. Fold
   A12-07/08 into the owner's SMS budget numbers.
3. **With Phase 4 polish or the first live adapter:** A12-03, A12-10, A12-11, A12-13, A12-14,
   A12-15.

## What's genuinely good

- **Send-time re-checks in one locked transaction** (`claimSend`): consent via `uf_may_process`,
  per-channel opt-in, cap and recent sends under `pg_advisory_xact_lock` per learner. The status
  flip to `sending` counts the claim at once. Two runners can't both take the last slot.
- **A defence in depth gate:** `GuardedChannel.#deliver` asks our own records just before the
  provider call, so a STOP that arrived a moment ago still counts, and a live adapter can't skip it.
- **Quiet hours and paper margins are exact.** Probes at 20:59:59.999/21:00:00.000,
  06:59:59.999/07:00:00.000, start−60:00 and end+30:00 all behaved. The fixed +02:00 offset is
  correct (SA has no DST). The cadence is a pure function with property tests over a simulated year.
- **STOP is never rate-limited**, records at once even before consent, and the reply doesn't reveal
  whether a number has an account.
- **Push content is variable-free** (`pushBody`), opens only a screen from a fixed list, and the
  permission is asked only on opt-in. `DeviceNotRegistered` forgets the token. Errors never quote a
  token or a body.
- **Job payloads carry IDs only**, enforced by type, at runtime and in the database. Retries back off
  and re-check everything. The idempotency key per reschedule prevents duplicate jobs.
- **Templates hold no admission facts** (no digits), every variable is length-limited and
  single-line, and university names come only from the verified catalogue.
- **Webhooks:** HMAC over timestamp and body, constant-time compare, size cap, and the stand-in route
  doesn't exist in live mode or without a secret.

Sources for WhatsApp policy: Meta, "Template categorization guidelines"
(developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/) on utility vs
marketing, "unclear content" and automatic recategorisation; WhatsApp Business Messaging Policy
(whatsappbusiness.com/policy/) on opt-in, honouring "all requests (either on or off WhatsApp)" to
opt out, and age gating. Both read on 2026-10-14.
