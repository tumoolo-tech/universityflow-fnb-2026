# PHASE-4 — A1 Review sign-in (PR #42)

**Project:** UniversityFlow · **Phase:** 4 · **Date:** 2026-10-14
**Commit:** 60309a1 · **Audit source:** tumoOLO_Audits @ 29eafd7
**Result:** 0 Critical · 0 High · 4 Medium · 3 Low · 0 waived · 4 not measured

Scope: `git diff 52557d9..60309a1` (branch `phase-4/review-sign-in`), security-weighted: the fenced
store-review sign-in (review-notes.md option A, finding A7-01). Every finding below was proven
with a throwaway test in a detached probe worktree (now removed); the probe files are kept in the
scratchpad at `a1probe/db-a1probe.test.ts` and `a1probe/web-a1probe.test.ts`. Each one **passes
while the weakness is there**. The PR's own suites pass: `review.test.ts` 18/18, `api-review.test.ts`
and `config.test.ts` 58/58.

## Executive summary

The fences that matter most hold. I could not open or create a learner's account through the
review path, whatever the number's format or the configuration's state. The fixed PIN does not
work with the variables unset, partly set, malformed or past their date. The review account
cannot request guardian consent, become a minor, or opt in to SMS or WhatsApp, and the database
enforces each of those, not only the store. `uf_app` has no `UPDATE` on `students`, so the
`review` flag can't be set from the app. Production still refuses every stand-in. No personal
information reaches the logs, the audit rows or the seed's output.

The weaknesses are in what the design promises next to what the code does. The fixed PIN is
refused after `UF_REVIEW_UNTIL`, but the **sessions it issued last 30 days longer**. The PIN is
**enumerable silently**: a fixed six-digit secret, 60 guesses an hour, no alert on a wrong one,
and no SMS cost to the attacker. The runtime **never checks that the configured number isn't a
learner's**. The seed script **runs migrations from the owner's local checkout against
production**. None of these opens real data, so nothing is graded Critical or High.

**Top 5 risks**
1. A1-18: a review session (or a session from a leaked PIN) outlives the window by up to 30 days.
   Nothing revokes it, and the owner steps call the account "harmless" afterwards.
2. A1-19: silent online guessing of a fixed PIN. Proven: walking 000000 upward opens an account
   whose PIN is 000059 in one simulated hour, and the 59 wrong guesses leave no audit row or alert.
   Over a 31-day window that is about a 4.5% chance.
3. A1-20: a typo in `UF_REVIEW_PHONE` in Vercel that lands on a learner's number silently locks
   that learner out of sign-in for the whole window, while `request-pin` still answers "sent".
4. A1-21: `review:seed` applies whatever migrations the owner's checkout holds, including
   unreviewed ones from a feature branch, to the production database.
5. A1-22: once the global SMS budget is spent, the review number is the only one that answers
   200. That is an oracle for confirming it from a list of candidate numbers.

## Findings

| ID | Severity | Location | Finding | Why it matters | Fix |
|---|---|---|---|---|---|
| A1-18 | Medium | `packages/db/src/store.ts:506-513` (session insert); `docs/store/review-notes.md:36, 92-93` | A review sign-in gets an ordinary 30-day session (`SESSION_TTL_MS`). Guard 4 stops new sign-ins after `UF_REVIEW_UNTIL`, and removing the config also stops them, but existing sessions keep working. **Proven:** a sign-in at `UNTIL - 1 min` still resolves in `sessionStudent` 29 days after the window, with the config removed. Nothing revokes it, and step 6 of the owner steps calls the account "harmless". | The PIN is shared with Apple and Google, so it is a password held by third parties. Whoever used it (a reviewer, or someone it leaked to) keeps a live session for up to 30 days after "expiry", including paid AI chat, uploads and push to their device. Guard 4 ("Expires") is true of the PIN but not of the access. | When `student.review`, set the session's `expiresAt` to `min(now + SESSION_TTL_MS, review.until)` (and refuse when no config is open). Also make `sessionStudent` refuse a review account's session once no review window is open, and add "delete the review account's sessions" to owner step 6. Test: sign in at `UNTIL - 1 min`, advance past `UNTIL`, and expect `sessionStudent` to return null. |
| A1-19 | Medium | `packages/db/src/store.ts:286-333, 479-491`; `apps/web/lib/server/review.ts:11-13`; `review-notes.md:38, 54` | The fixed PIN gets the per-challenge limit (5 tries), but a new challenge is free every 5 minutes (3 in 15): 12 challenges and **60 guesses an hour**. A fixed secret lets the guesses accumulate without repeats. Asking for the review number's PIN sends nothing and spends no budget, so nobody sees it, and the only alert fires on **success**. **Proven:** with PIN `000059`, walking `000000` upward opened the account on guess 60 in one simulated hour; the audit log held only the seed rows and the final `auth.review-signed-in`. | Over a 31-day window that is 44,640 guesses, about a 4.5% chance of opening the account, against a real learner's number where every challenge sends an SMS that the learner notices and that costs budget. "Five wrong PINs lock it" (the doc) is per challenge, not a lock. The impact is the synthetic account plus its paid quotas, so Medium, not High. | Give review challenges their own failure budget: for example, after 10 wrong review PINs in the window, refuse the review sign-in until the owner redeploys. Log or alert on every wrong review PIN (ids only), not only on success. Fix the doc wording. Test: 11 wrong guesses across 3 challenges, then expect the correct PIN to be refused and a warning per failure. |
| A1-20 | Medium | `packages/db/src/store.ts:268-272, 292-295`; `apps/web/app/api/auth/request-pin/route.ts:25` | `#openReview` matches only the configured number. It never checks that the account on that number, if any, is the review account. If `UF_REVIEW_PHONE` in Vercel names a learner's number (a typo; the seed runs from the owner's shell with its own copy of the number, so the seed's refusal doesn't catch it), every PIN request for that learner gets a review challenge: **no SMS**, while the route answers 200 "sent". **Proven:** a signed-up learner's number configured as the review number gets `review: true`; the fixed PIN gives "expired" (correctly not opened). | A real learner, likely a minor, can't sign in for up to 31 days and is told a PIN was sent. Guard 2 ("so it can never be a learner's number") is a procedure, not code. No one is alerted. | In `requestOtp`, inside the lock, read the `students` row for the number. If it exists and isn't `review`, take the ordinary SMS path and log `store-review misconfigured` (ids only). Optionally `verifyOtp` should refuse in the same way. Test: configure a signed-up learner's number, then expect `challenge.review === false` with a code. |
| A1-21 | Medium | `packages/db/scripts/review-seed.ts:28-29`; `packages/db/src/client.ts:64-83` | The seed calls `migrate(database)` with the owner's credentials against production, from whatever checkout the owner is on. `migrate` applies every migration in the local `MIGRATIONS` that the database lacks and records its id as applied. | Run from a feature branch, it applies an unreviewed, unmerged migration to production. Because ids are append-only and recorded, the reviewed version of that migration never runs after merge, and prod's schema drifts silently. That is a schema change to production outside the PR, CI or deploy path. | Don't migrate in the seed. Compare `uf_migrations` with `MIGRATIONS` ids and refuse unless they are equal (the deploy is the only migrator). Test: a database with one fewer migration than `MIGRATIONS` makes the seed exit non-zero, and `uf_migrations` is unchanged. |
| A1-22 | Low | `apps/web/app/api/auth/request-pin/route.ts:25-27` | The review number returns before `sms.send`. With a live provider it answers faster than any other number, which is a timing difference. Once the global SMS budget is spent, every other number gets **503** while the review number gets **200**. **Proven** over the real route: `[503, 503, 200, 503]` for four candidates. | It confirms the review number from a candidate list, the first half of A1-19. Enumerating SA mobile numbers is infeasible, and each probe of a non-review number costs a real SMS while budget remains, so Low. | When `challenge.review`, consult the same budget gate (take and immediately return a token, or check `allowed`) so the review number fails the same way; add a small constant delay or run a no-op send of equal latency. Test: spend the budget, then expect the review number to get 503 too. |
| A1-23 | Low | `docs/store/review-notes.md:26-27, 38, 54, 74` | The guard list says "Two variables, both required"; the code requires three. "Five wrong PINs lock it" overstates the limit, which is per challenge (see A1-19). The hashing one-liner passes `AUTH_SECRET` and the PIN as argv, visible to `ps` on a shared machine, as well as in history. | The owner runs production from this page. A wrong mental model ("locked after five") leads to a weaker PIN-rotation habit. | Say three variables. Describe the limit honestly. Read the PIN and secret from stdin or the environment (`process.env`), not argv. Docs only, so no test. |
| A1-24 | Low | `packages/db/src/store.ts:775-786`; `review-notes.md:89-90, 142-143` | If a reviewer deletes the account (the notes invite it) and anyone holding the SIM later signs in by SMS outside a window, an ordinary account is created on the number. The seed then refuses ("not for review"), and the next submission's fixed PIN gives "expired". **Proven.** | An operational trap at the next submission. No data exposure; the owner controls the SIM. | Document it in the owner steps (delete that ordinary account first), or have the seed say exactly that. Optional test: the seed's error names the remedy. |

## Assessed, no finding

- **The PIN when the env is unset, partly set, malformed or expired:** refused in every case.
  `readReview` refuses one or two of three, an empty value, a landline, an upper-case, short or
  clear-text hash, non-ISO dates, `2026-02-30`, and windows over 31 days. The `+02:00`
  end-of-day check is correct (SA has no DST), and `toISOString().slice(0,10)` compares in UTC
  where 21:59Z is the same day. `verifyOtp` re-checks the window and the config, so a challenge
  made in time is refused after (`store.ts:481`). The store validates again (`validReview`). A
  past date is accepted and simply inert, which the authors intended and tested.
- **A learner's account opened or created:** not possible. `0…`, `27…`, `+27…` and spaced variants
  all normalise to one E.164 number (probed); the PIN hash binds the number. A review challenge
  opens only a `review` row and never inserts one (`store.ts:494`). The seed refuses a number held
  by a non-review account.
- **Escaping the fences:** `setDateOfBirth` refuses because the status isn't `unknown`. The
  `students_review_adult` CHECK blocks `pending`. Triggers block `guardian_consents` inserts and
  updates and SMS or WhatsApp opt-in, even as the owner, and both fire under `uf_app`. STOP still
  opts out. `uf_app` has only `select, delete` on `students`. Export and delete work, and delete
  cascades.
- **The hash scheme:** HMAC-SHA256 keyed by `AUTH_SECRET`. A leaked `UF_REVIEW_PIN_HASH` alone
  can't be guessed offline. With `AUTH_SECRET` as well, the six-digit PIN falls in under a second,
  exactly as every stored PIN hash does. The review hash lives up to 31 days (and is copied into
  `otp_challenges.code_hash`) rather than 10 minutes. But both values sit in the same Vercel scope
  as `DATABASE_URL`, so whoever can read them already has more than the review account. That is
  not materially worse in practice.
- **PII:** the alert line, `auth.review-signed-in`, `account.review-seeded` and the seed's output
  carry ids only. The seed's error path prints the message only, and store messages hold no
  number. Test numbers are built at runtime.
- **Production and stand-ins:** `readReview` is independent of `UF_PROVIDERS`. Production with
  `UF_PROVIDERS=local` is still refused (`config.test.ts` guard 6). `UF_PROVIDERS=local` doesn't
  change the review path.
- **Native path:** `verify-pin` returns the same `{ok,isNewStudent,token}` keys for the review
  account. Native code is unchanged.
- **`uf_is_review` is `security definer` and executable by `uf_app` for any id:** it reveals one
  boolean about a uuid the caller already holds. It is not reachable with user-chosen ids, and it
  pins `search_path`. Acceptable.

## Not measured

1. **The real timing gap over a live SMS provider.** No provider is connected (D8), and the
   stand-in sends in memory. A1-22's budget oracle is proven; the latency gap is inferred from the
   code path.
2. **The real-Postgres suite** (`TEST_DATABASE_URL`). The probes and the PR's tests ran on PGlite.
   The trigger, CHECK and `security definer` behaviour under a separate owner role on server
   Postgres was not run.
3. **The native app on a device** (the reviewer's actual flow, and push for the review account).
4. **`pnpm verify`, build and E2E.** Not run, by instruction. `pnpm install` in the probe ran
   lefthook's `prepare`, which re-synced the shared repo's git hooks (same config, no content
   change expected).

## Waived

None.

## Remediation roadmap

- **Quick wins (< 1 day):** A1-18 (cap the review session at `until`, and add revocation to step
  6), A1-20 (the ordinary path when the number's account isn't `review`), A1-21 (the seed asserts
  migrations instead of running them), A1-23 (doc), A1-24 (doc or seed message).
- **Medium:** A1-19 (a window-wide failure budget for review challenges, and an alert per wrong
  PIN), A1-22 (the review number answers like the others under budget exhaustion).
- **Structural:** none. The design (config in the app, invariants in the database) is sound.

## What's genuinely good

- **The invariants live in the database, not in routes.** `students_review_adult`, the two
  triggers, and `review` set only by a role the app can't use. The PR's tests insert straight into
  the tables as the owner to prove the database refuses.
- **The review PIN runs through the same path as every PIN.** Same challenge row, same
  `sameHash`/`timingSafeEqual`, same lock and limits, so there is no second comparison to get
  wrong.
- **It fails closed everywhere I pushed.** Partial config refuses to start. The window is
  re-checked at verify, not only at request. A missing seeded account is "expired", never a
  created one. Removing the config kills open challenges.
- **No PII in the new surfaces,** and the alert carries ids only.
- **Honest tests.** Each guard's test exercises behaviour, not a mock. The budget-of-one SMS trick
  in `api-review.test.ts` is a clean proof that the review number spends nothing.
