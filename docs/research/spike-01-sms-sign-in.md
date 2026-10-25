# Spike 1: Phone sign-in with a South African SMS provider

**Written:** 2026-10-13 · **Base commit:** `254550a` · **Planning:** §16.1 spike 1, §16.5, D4, D8

| | Verdict |
|---|---|
| **Stand-in** | **Holds.** Our own OTP flow is built and tested end to end against the in-memory outbox |
| **Real service** | **Not started.** No SMS provider is chosen, so no live adapter exists. Blocked on the owner |

## The question

Can a learner sign in with only a South African cellphone number and a one-time PIN sent by
SMS, through a flow we own (D4: "Student number + ID number isn't a secret"), with a local SMS
provider that delivers fast and reliably enough to be the front door of the product?

**Why it matters.** Sign-in is the first thing every learner does, many on prepaid phones with
no email address. If PINs arrive late or not at all, nobody gets past the first screen. Planning
§16.1 (revised 2026-10-13) moved accounts from Better Auth to our own OTP flow in `packages/db`,
so the design to prove is ours, and the provider is the one swappable part.

## Stand-in verdict: holds

What is built:

- **The interface.** `SmsSender` in [packages/messaging/src/sms.ts](../../packages/messaging/src/sms.ts),
  with `validateSms` (E.164 `+27` numbers only, non-empty, at most 480 characters) and the local
  stand-in `MemoryOutbox`.
- **The contract every provider must meet.** `smsContract` in
  [packages/messaging/src/sms.contract.ts](../../packages/messaging/src/sms.contract.ts): accepts
  a South African number and returns a receipt id; refuses a number outside South Africa;
  refuses an empty or over-long message.
- **The global budget** wrapped around whatever provider is used: `BudgetedSmsSender`
  ([packages/messaging/src/budget.ts](../../packages/messaging/src/budget.ts)), counted in
  Postgres by `takeBudget` ([packages/db/src/store.ts](../../packages/db/src/store.ts)), failing
  closed (open finding A1-01, fixed).
- **The OTP flow.** `requestOtp` and PIN verification in `packages/db/src/store.ts`: PINs stored
  only as keyed hashes, 10-minute expiry (`OTP_TTL_MS`), lockout after 5 wrong attempts
  (`OTP_MAX_ATTEMPTS`), one PIN a minute and three per number per 15 minutes, a cap per IP,
  checks under an advisory lock. 30-day sessions stored as hashes.
- **The routes.** [apps/web/app/api/auth/request-pin/route.ts](../../apps/web/app/api/auth/request-pin/route.ts)
  and `verify-pin`, same-origin checked; cookie for the web, bearer token for the app.
- **The live switch.** `SMS_ADAPTERS` in
  [apps/web/lib/server/sms-providers.ts](../../apps/web/lib/server/sms-providers.ts) is empty on
  purpose, and `UF_PROVIDERS=live` refuses to start without an adapter named by `UF_SMS_PROVIDER`.

What the tests prove (names exactly as in the code):

| File | Tests |
|---|---|
| `packages/messaging/src/sms.test.ts` | `MemoryOutbox meets the SMS contract` (the three contract cases); `keeps what was sent, newest first, per number` |
| `packages/messaging/src/budget.test.ts` | `BudgetedSmsSender meets the SMS contract`; `sends while under the budget and at it, then fails closed`; `lets two sends racing for the last slot through only once`; `spends no budget on a message the provider would refuse`; `fails closed when the ledger itself fails`; `logs counts and labels only by default: no number, no body (hard rule 4)` |
| `packages/db/src/store.test.ts` | `phone numbers`: `normalises every common way of writing a cellphone number`, `refuses landlines and nonsense`, `masks a number down to its last three digits`. `sign-in with a one-time PIN`: `creates the account on first sign-in and reuses it after`, `stores the PIN only as a keyed hash`, `refuses a wrong PIN and locks the challenge after five attempts`, `refuses an expired PIN`, `refuses a PIN that has already been used`, `allows one PIN a minute and three per number in fifteen minutes`, `caps PIN requests per IP address across many numbers (audit finding 4)`, `counts parallel requests correctly (no race past the limit)`, `refuses a non-numeric PIN without comparing it`. `sessions`: `resolves a token to its student, stores only its hash, and ends on sign-out`, `expires after thirty days` |
| `packages/db/src/budget-uploads.test.ts` | `takeBudget: the global SMS budget, counted in Postgres (open finding 1)` (7 tests incl. `lets only one of several racing sends take the last slot`) |
| `apps/web/test/api.test.ts` | `sign-in`: `sends a PIN by SMS without ever returning it, and signs in with it`, `refuses a landline`, `signs out`. `security`: `accepts the mobile app’s bearer token without an origin`, `refuses a cookie-authenticated write from another site (CSRF)` |
| `apps/web/test/api-sms-budget.test.ts` | `fails closed across different numbers, with a safe sentence from packages/content` |
| `apps/web/test/config.test.ts` | `refuses today: no SMS adapter has been written yet` |
| `apps/web/test/services.test.ts` | `uses S3 for files and direct uploads, the named SMS adapter inside the budget, and no outbox` (with a fake adapter); `refuses a live configuration without S3 or without an SMS adapter` |
| `apps/web/e2e/journey.spec.ts` | Every journey signs in through the real pages with the PIN read from the dev outbox (`signIn` in `e2e/helpers.ts`), e.g. `an adult learner goes from sign-in to an application pack` |

Commands run on 2026-10-13 (this branch):

```text
pnpm --filter @universityflow/messaging exec vitest run src/sms.test.ts src/budget.test.ts
  Test Files  2 passed (2) · Tests  19 passed (19)
pnpm --filter @universityflow/db exec vitest run src/store.test.ts -t "phone numbers|sign-in with a one-time PIN|sessions"
  Test Files  1 passed (1) · Tests  16 passed | 36 skipped (52)   (the 36 are the other describes, filtered out)
pnpm --filter @universityflow/messaging test   → Tests  31 passed (31)
pnpm --filter @universityflow/db test          → Tests  68 passed | 4 skipped (72)   (4 = real-Postgres suite, needs TEST_DATABASE_URL)
pnpm --filter @universityflow/web test         → Tests  88 passed (88)
```

E2E result: see [spikes.md](spikes.md#commands-run).

**So the design holds:** the flow, its limits, the budget and the live/local switch work, and
production cannot fall back to the stand-in. What the stand-in **cannot** tell us is anything
about delivery: speed, reliability across networks (Vodacom, MTN, Cell C, Telkom), sender ID,
or cost. The contract is deliberately small and says nothing about those either.

## Real-service verdict: not started

**Blocked on:** the owner choosing a South African SMS provider on current quotes (status.md
decisions log, 2026-10-13: "SMS provider not chosen"). Planning §16.1 defers the choice to
Phase 4, but sign-in needs it for the March 2027 launch, so it can't wait for Phase 4.

**Needed:** a provider account with a registered sender ID; its API credentials as new
environment variables (named by the adapter, added to `.env.example`, which
`config.test.ts`'s `documents every variable the app reads` enforces); `UF_SMS_PROVIDER=<name>`;
real numbers for `UF_SMS_BUDGET_PER_HOUR` and `UF_SMS_BUDGET_PER_DAY` (300 and 2000 are
placeholders).

### Steps at integration

1. Write the adapter in `apps/web/lib/server/` (or `packages/messaging`), implementing
   `SmsSender` and calling `validateSms` first, as `MemoryOutbox` does. No logging of number or
   body (hard rule 4).
2. Add a gated contract test for it, the same pattern as the real-S3 suite in
   `packages/documents/src/s3.test.ts` (`describe.skipIf(!endpoint)`): run
   `smsContract(() => new TheAdapter(env), process.env.TEST_SMS_TO)` only when the provider's
   test credentials and a test handset number are set. The number is the owner's own test
   handset, never a learner's, and never committed.
3. Write its inbound half too (A5-02): an `InboundVerifier` for the provider's webhooks (its
   signature, a freshness window, a replay key, and a mapping of STOP, replies and delivery
   reports to `InboundEvent`), held to `inboundContract` from
   `@universityflow/messaging/inbound-contract`, as `apps/web/test/fake-live-provider.ts` is.
   An `SmsAdapter` is `{ sender, inbound }`; live mode refuses one without `inbound`, because
   every SMS tells the learner they can reply STOP. Point the provider's inbound and
   delivery-report webhooks at `/api/messaging/sms/inbound`.
4. Only when both suites pass, list the adapter in `SMS_ADAPTERS`. Then
   `config.test.ts`'s `refuses today: no SMS adapter has been written yet` must be updated in
   the same PR, since it will no longer be true.
5. Delivery trial (manual, from a staging deploy in `cpt1`): request **20 PINs** to test
   handsets on **each of Vodacom, MTN, Cell C and Telkom** (prepaid SIMs), spread across a
   weekday and an evening. Record request time and arrival time on the handset.
6. Sign in end to end on a real phone (web and the Expo app) with the delivered PIN. Reply STOP
   to a reminder from a test handset and confirm the channel is off at once.

### Pass criteria (proposed here; the owner confirms the numbers)

- The SMS contract suite and the inbound contract suite pass against the live adapter.
- Every one of the 80 trial PINs arrives; **95% within 30 seconds, none later than 2 minutes**
  (the PIN is valid for 10 minutes, `OTP_TTL_MS`).
- The sender ID shows consistently, and the message reads correctly (no mangled characters:
  the body is `en.auth.smsBody`, which must stay within one GSM-7 segment).
- A provider error reaches the learner as the safe `smsUnavailable` sentence, not a crash.
- Cost per PIN, written down, feeds the D5 cost model and the real budget numbers.

## Risks and fallback

- **One provider, one point of failure.** If it is down, nobody signs in. Fallback: the adapter
  registry already allows a second provider; a failover sender (try A, then B) is a small
  change behind the same interface.
- **A send that fails after the PIN is issued still counts** against that number's limit (one a
  minute, three per 15 minutes), because `requestOtp` runs before `sms.send` in
  `request-pin/route.ts`. In an outage a learner can burn their attempts. Worth deciding at
  integration whether a failed send should release the slot.
- **The provider's latency is inside the request.** `request-pin` awaits the send; a slow
  provider API makes the sign-in button slow. Measure it in step 4.
- **Number pumping / cost abuse** is bounded by the per-number, per-IP and global limits;
  A1-05 (a number held at its limit from many IPs) stays open until alerts reach a person.
- **If the spike fails** (no SA provider meets the criteria): swap the provider, not the flow.
  The flow is ours and tested. Last resort: WhatsApp OTP through the Phase 4 messaging adapter,
  or email OTP (D4 already plans email later).
